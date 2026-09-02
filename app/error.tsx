"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="content" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div className="panel" style={{ maxWidth: 460, padding: 32, textAlign: "center" }}>
        <AlertTriangle size={28} style={{ color: "var(--danger)" }} />
        <h1 style={{ margin: "14px 0 8px", fontSize: "var(--fs-title)" }}>Something went wrong</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          An unexpected error occurred while loading this page.
          {error.digest && (
            <>
              <br />
              <span style={{ fontSize: "var(--fs-label)" }}>Reference: {error.digest}</span>
            </>
          )}
        </p>
        <button type="button" className="btn" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
