import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell">
      <div className="main">
        <div className="empty-state">
          <div>
            <h2>Page not found</h2>
            <p className="muted">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
            <Link href="/dashboard" className="button">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
