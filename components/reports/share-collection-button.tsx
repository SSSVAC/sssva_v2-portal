"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { shareOrCopyText } from "@/lib/export";
import {
  RECENT_COLLECTION_DAYS,
  buildRecentCollectionText,
  takeRecentDays,
  type SummaryMetric
} from "@/lib/reports/recent-collection";
import type { ContributionDateGroup } from "@/lib/reports/contribution-entries";

type ShareCollectionButtonProps = {
  /** Report title, used as the message's heading and the share sheet's. */
  title: string;
  subtitle?: string;
  /** The headline figures the message leads with, already formatted. */
  metrics: SummaryMetric[];
  /** Every day the report knows about; the last few are what gets shared. */
  groups: ContributionDateGroup[];
  days?: number;
};

/**
 * Shares the fund's headline figures plus the last few collection days as one
 * WhatsApp-ready message — the update a group leader sends after an evening's
 * round, without exporting a whole report to do it.
 */
export function ShareCollectionButton({
  title,
  subtitle,
  metrics,
  groups,
  days = RECENT_COLLECTION_DAYS
}: ShareCollectionButtonProps) {
  const { showToast } = useToast();
  const [sharing, setSharing] = useState(false);

  const recent = takeRecentDays(groups, days);
  // Nothing dated to report on: the button would share the totals under a
  // heading promising days that don't exist.
  if (recent.length === 0) return null;

  const label = recent.length === 1 ? "Share latest day" : `Share last ${recent.length} days`;

  async function share() {
    setSharing(true);
    try {
      const result = await shareOrCopyText(
        title,
        buildRecentCollectionText({ title, subtitle, metrics, groups, days })
      );
      if (result === "copied") {
        showToast("Summary copied — paste it into WhatsApp.", "success");
      }
    } catch (error) {
      console.error("Share failed", error);
      showToast("Could not share the summary. Please try again.", "error");
    } finally {
      setSharing(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      disabled={sharing}
      onClick={() => void share()}
    >
      <Share2 size={14} />
      {sharing ? "Sharing…" : label}
    </button>
  );
}
