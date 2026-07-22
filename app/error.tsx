"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shell">
      <div className="main">
        <div className="empty-state">
          <div>
            <h2>Something went wrong</h2>
            <p className="muted">An unexpected error occurred while loading this page.</p>
            <button type="button" className="button" onClick={() => reset()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
