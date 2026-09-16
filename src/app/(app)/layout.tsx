import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <Nav />
      <main className="app-main">{children}</main>
    </>
  );
}
