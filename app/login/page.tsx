import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-art" aria-label="Finance workspace">
        <h1>SSSVA Portal</h1>
        <p>
          A focused operating dashboard for Supabase-backed finance data, secure
          authentication, and scheduled Zoho Books synchronization.
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>Sign in</h2>
          <p className="muted">Use your portal account to continue.</p>

          <form action={signIn} className="form">
            {params.error ? <div className="error-box">{params.error}</div> : null}

            <label className="field">
              <span>Email</span>
              <input className="input" name="email" type="email" required />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                className="input"
                name="password"
                type="password"
                minLength={6}
                required
              />
            </label>

            <button className="button" type="submit">
              <LogIn size={18} />
              Sign in
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
