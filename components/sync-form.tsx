"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function SyncForm() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form action="/api/jobs/zoho-sync" method="post" onSubmit={() => setSubmitting(true)}>
      <div className="sync-form-row">
        <label htmlFor="sync-target">Sync</label>
        <select
          id="sync-target"
          name="sync_target"
          defaultValue="all"
          className="sync-target-select"
          disabled={submitting}
        >
          <option value="all">Sync All</option>
          <option value="customers">Customers Only</option>
          <option value="invoices">Invoices Only</option>
          <option value="expenses">Expenses Only</option>
          <option value="bills">Bills Only</option>
        </select>
      </div>
      <button className="button" type="submit" disabled={submitting}>
        <RefreshCw size={17} />
        {submitting ? "Syncing…" : "Sync Zoho"}
      </button>
    </form>
  );
}
