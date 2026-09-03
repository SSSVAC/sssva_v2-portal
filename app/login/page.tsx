import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { guestSessionsEnabled } from "@/lib/auth/guest-pass";
import { GUEST_HOME } from "@/lib/auth/guest-scope";
import { getViewer } from "@/lib/auth/viewer";

const SHARE_PROBLEM: Record<string, string> = {
  invalid: "That share link isn't valid. Please ask whoever sent it for a new one.",
  revoked: "That share link has been revoked. Please ask whoever sent it for a new one.",
  expired: "That share link has expired. Please ask whoever sent it for a new one.",
  disabled: "Share links aren't enabled on this deployment."
};

type LoginPageProps = {
  searchParams: Promise<{ share?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Guests hold a cookie rather than a Supabase session, so checking only
  // auth.getUser() here would show them the sign-in form again after they
  // had already been let in.
  const { share } = await searchParams;
  const shareProblem = share ? SHARE_PROBLEM[share] : undefined;
  const viewer = await getViewer();

  if (viewer) {
    redirect(viewer.kind === "guest" ? GUEST_HOME : "/dashboard");
  }

  return (
    <main className="auth-page">
      {/* The art panel is built entirely from brand tokens and gradients.
          It used to load a stock office photo from Unsplash — a
          third-party request on the one page that must always render, and
          an odd fit for a temple association's portal. */}
      <section className="auth-art" aria-hidden="true">
        <div className="auth-art-brand">
          <span className="brand-mark">SV</span>
          SSSVA Portal
        </div>

        <div className="auth-art-body">
          <h1>Every rupee, accounted for.</h1>
          <p>
            Contributions, expenses and bills from Zoho Books — reconciled, grouped by street, and
            ready to print or share.
          </p>
        </div>

        <div className="auth-art-foot">
          <span>11 reports</span>
          <span>4 record tables</span>
          <span>Zoho Books sync</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>Sign in</h2>
          <p className="muted">Use your portal account, or a guest code, to continue.</p>
          {shareProblem && (
            <div className="error-box" role="alert" style={{ marginTop: 16 }}>
              {shareProblem}
            </div>
          )}
          <LoginForm guestEnabled={guestSessionsEnabled()} />
        </div>
      </section>
    </main>
  );
}
