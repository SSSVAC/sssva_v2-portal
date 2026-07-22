"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { signIn, type SignInState } from "@/app/login/actions";

const initialState: SignInState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="form">
      {state.error ? (
        <div className="error-box" role="alert">
          {state.error}
        </div>
      ) : null}

      <label className="field">
        <span>Email</span>
        <input className="input" name="email" type="email" required disabled={pending} />
      </label>

      <label className="field">
        <span>Password</span>
        <input className="input" name="password" type="password" minLength={6} required disabled={pending} />
      </label>

      <button className="button" type="submit" disabled={pending}>
        <LogIn size={18} />
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
