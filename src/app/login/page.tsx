import LoginForm from "./LoginForm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/today");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--cream)",
      }}
    >
      <div className="card" style={{ width: 360 }}>
        <div className="brand" style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 30 }}>₦</div>
          <div>
            <h1 style={{ fontSize: 20, margin: 0, color: "var(--brown)" }}>The Right Choice</h1>
            <small className="label">Sign in to continue</small>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
