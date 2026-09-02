"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

// Inline now — target select and trigger sit on one line in the page
// header's action slot, instead of a stacked label/select/button block that
// pushed the page title off its own baseline.
export function SyncForm() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action="/api/jobs/zoho-sync"
      method="post"
      onSubmit={() => setSubmitting(true)}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <label className="visually-hidden" htmlFor="sync-target">
        Sync target
      </label>
      <select
        id="sync-target"
        name="sync_target"
        defaultValue="all"
        className="select"
        disabled={submitting}
      >
        <option value="all">All data</option>
        <option value="customers">Customers only</option>
        <option value="invoices">Invoices only</option>
        <option value="expenses">Expenses only</option>
        <option value="bills">Bills only</option>
      </select>
      <button className="btn" type="submit" disabled={submitting}>
        <RefreshCw size={15} />
        {submitting ? "Syncing…" : "Sync Zoho"}
      </button>
    </form>
  );
}
