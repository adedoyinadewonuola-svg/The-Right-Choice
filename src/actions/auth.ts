"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { signIn, signOut } from "@/lib/auth";
import { attemptKey, checkAttempts, retryMessage } from "@/lib/rate-limit";

export async function loginAction(_prevState: string | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Failures are counted in the `authorize` callback; here we only refuse to try again while a
  // window is still open, so the clerk gets a real message instead of another "invalid".
  const limit = checkAttempts(attemptKey(email, (await headers()).get("x-forwarded-for")));
  if (!limit.allowed) return retryMessage(limit.retryAfterSeconds);

  try {
    await signIn("credentials", { email, password, redirectTo: "/today" });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Invalid email or password.";
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
  redirect("/login");
}
