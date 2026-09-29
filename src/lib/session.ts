import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * Guard for Server Actions.
 *
 * The `(app)` layout only protects *rendering* of a page. A Server Action is a
 * separate POST to the same URL that React dispatches before (or without) any
 * layout runs, so every mutation must check the session itself.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect("/login");
  }

  return {
    id: user.id,
    name: user.name ?? "Staff",
    email: user.email ?? "",
    role: user.role ?? "staff",
  };
}
