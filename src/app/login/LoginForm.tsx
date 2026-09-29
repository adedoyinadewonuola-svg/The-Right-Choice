"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";

export default function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" required />
      </div>
      {error && <div className="notice danger">{error}</div>}
      <button type="submit" className="btn gold" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
