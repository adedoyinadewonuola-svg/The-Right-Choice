import { headers } from "next/headers";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { attemptKey, checkAttempts, clearAttemptsForEmail, recordFailedAttempt } from "@/lib/rate-limit";

/** Best-effort client IP; absent on a same-origin dev server, present behind a proxy. */
async function requestIp(): Promise<string | null> {
  try {
    return (await headers()).get("x-forwarded-for");
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required in production: without it Auth.js refuses the `Host` header, and every
  // /api/auth/* request answers 500 "UntrustedHost: Host must be trusted".
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Enforced here rather than only in `loginAction`: a client can post straight to
        // /api/auth/callback/credentials and skip the action, so an action-only check is bypassable.
        const key = attemptKey(email, await requestIp());
        if (!checkAttempts(key).allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        // A successful `signIn` throws a redirect, so failure/success bookkeeping has to happen
        // here — code after the `await` in the action never runs when the sign-in succeeds.
        if (!valid) {
          recordFailedAttempt(key);
          return null;
        }
        clearAttemptsForEmail(email);

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string | undefined;
      }
      return session;
    },
  },
});