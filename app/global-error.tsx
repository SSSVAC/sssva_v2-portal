"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="shell">
          <div className="main">
            <div className="empty-state">
              <div>
                <h2>Something went wrong</h2>
                <p className="muted">The application hit an unexpected error.</p>
                <button type="button" className="button" onClick={() => reset()}>
                  Try again
                </button>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
