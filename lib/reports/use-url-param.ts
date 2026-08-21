"use client";

import { useCallback } from "react";

// Cosmetic-only URL sync for report filters (month/year/toggle selections).
// Uses history.replaceState directly instead of Next's router so it never
// triggers a server round-trip or re-fetch — the data for every option is
// already on the client. The point is purely to make the current view
// bookmarkable/shareable; the initial value on load still comes from the
// server (each report's loader reads the same search params), so SSR output
// and first client render always agree.
export function useUrlParamSetter() {
  return useCallback((updates: Record<string, string | null>) => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    }
    window.history.replaceState(null, "", url);
  }, []);
}
