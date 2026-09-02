"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main className="content" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
          <div className="panel" style={{ maxWidth: 460, padding: 32, textAlign: "center" }}>
            <h1 style={{ marginBottom: 8, fontSize: "var(--fs-title)" }}>Something went wrong</h1>
            <p className="muted" style={{ marginBottom: 20 }}>
              The application hit an unexpected error.
            </p>
            <button type="button" className="btn" onClick={() => reset()}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
