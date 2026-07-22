import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

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

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
