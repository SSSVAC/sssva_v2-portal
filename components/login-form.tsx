"use client";

import { useActionState, useState } from "react";
import { KeyRound, LogIn } from "lucide-react";
import { signIn, signInAsGuest, type SignInState } from "@/app/login/actions";

const initialState: SignInState = { error: null };

type Mode = "staff" | "guest";

export function LoginForm({ guestEnabled }: { guestEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>("staff");
  const [staffState, staffAction, staffPending] = useActionState(signIn, initialState);
  const [guestState, guestAction, guestPending] = useActionState(signInAsGuest, initialState);

  const state = mode === "staff" ? staffState : guestState;

  return (
    <>
      {guestEnabled && (
        <div className="segmented" style={{ width: "100%", marginTop: 20 }}>
          <button
            type="button"
            className={`segment${mode === "staff" ? " segment-active" : ""}`}
            style={{ flex: 1, justifyContent: "center" }}
            aria-pressed={mode === "staff"}
            onClick={() => setMode("staff")}
          >
            Staff
          </button>
          <button
            type="button"
            className={`segment${mode === "guest" ? " segment-active" : ""}`}
            style={{ flex: 1, justifyContent: "center" }}
            aria-pressed={mode === "guest"}
            onClick={() => setMode("guest")}
          >
            Guest code
          </button>
        </div>
      )}

      {state.error ? (
        <div className="error-box" role="alert" style={{ marginTop: 16 }}>
          {state.error}
        </div>
      ) : null}

      {mode === "staff" ? (
        <form action={staffAction} className="form">
          <label className="field">
            <span>Email</span>
            <input className="input" name="email" type="email" required disabled={staffPending} />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="input"
              name="password"
              type="password"
              minLength={6}
              required
              disabled={staffPending}
            />
          </label>

          <button className="btn" type="submit" disabled={staffPending}>
            <LogIn size={16} />
            {staffPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form action={guestAction} className="form">
          <label className="field">
            <span>Guest code</span>
            <input
              className="input"
              name="code"
              type="text"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="SSSVA-XXXX-XXXX-XXXX"
              disabled={guestPending}
              style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
            />
          </label>

          <button className="btn" type="submit" disabled={guestPending}>
            <KeyRound size={16} />
            {guestPending ? "Checking…" : "Continue as guest"}
          </button>

          <p className="muted" style={{ fontSize: "var(--fs-small)" }}>
            Guest access is view-only and expires on the date set for your code.
          </p>
        </form>
      )}
    </>
  );
}
