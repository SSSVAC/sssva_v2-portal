import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="content" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div className="panel" style={{ maxWidth: 460, padding: 32, textAlign: "center" }}>
        <FileQuestion size={28} style={{ color: "var(--text-muted)" }} />
        <h1 style={{ margin: "14px 0 8px", fontSize: "var(--fs-title)" }}>Page not found</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <Link href="/dashboard" className="btn">
          Back to Overview
        </Link>
      </div>
    </main>
  );
}
