import { formatCurrency, formatDateOnly } from "@/lib/format";
import type { ContributionDateGroup } from "@/lib/reports/contribution-entries";

/** What "recent" means when nobody says otherwise. */
export const RECENT_COLLECTION_DAYS = 3;

export type SummaryMetric = { label: string; value: string };

/**
 * The most recent days that actually took money, newest first.
 *
 * Days rather than dates: a fund collects on the days someone walks the
 * street, so the last three *calendar* days are usually two empty ones and a
 * total — the three most recent collection days are what a group leader
 * means by "the last few days". Undated contributions (Zoho carries no date
 * for a handful) have no place on that timeline and are left out; the fund
 * totals in the same message still count them.
 */
export function takeRecentDays(
  groups: ContributionDateGroup[],
  days = RECENT_COLLECTION_DAYS
): ContributionDateGroup[] {
  return groups
    .filter((group) => group.dateKey !== null)
    // The caller's groups follow the order toggle on screen, so this sorts
    // rather than trusting it. Zoho dates are ISO, so lexical order is date
    // order.
    .sort((a, b) => (b.dateKey ?? "").localeCompare(a.dateKey ?? ""))
    .slice(0, days);
}

export function sumDays(groups: ContributionDateGroup[]) {
  return groups.reduce((sum, group) => sum + group.subtotal, 0);
}

function countRows(groups: ContributionDateGroup[]) {
  return groups.reduce((count, group) => count + group.rows.length, 0);
}

/**
 * A WhatsApp-ready collection summary: the fund's headline figures, then
 * what came in on each of the last few collection days.
 *
 * `*bold*` and `_italic_` are WhatsApp's own markdown, as in the other copy
 * exports. Phone numbers are deliberately left out — this message is meant to
 * be forwarded around a group, and a name, a street and an amount are what
 * the reader is checking.
 */
export function buildRecentCollectionText({
  title,
  subtitle,
  metrics,
  groups,
  days = RECENT_COLLECTION_DAYS,
  now = new Date()
}: {
  title: string;
  subtitle?: string;
  metrics: SummaryMetric[];
  groups: ContributionDateGroup[];
  days?: number;
  now?: Date;
}): string {
  const recent = takeRecentDays(groups, days);
  // Same formatter as the day labels above it, so the message doesn't date
  // itself in one timezone and its days in another.
  const generatedOn = formatDateOnly(now.toISOString());

  const lines = [`*${title}*`];
  if (subtitle) lines.push(subtitle);
  lines.push("");

  metrics.forEach((metric) => lines.push(`*${metric.label}:* ${metric.value}`));
  lines.push("");

  if (recent.length === 0) {
    lines.push("_No dated contributions recorded yet._");
  } else {
    // Says "last N days" only when there are N to show, so a fund two days
    // old doesn't claim a third day nobody collected on.
    lines.push(
      recent.length === 1
        ? "*Latest collection day*"
        : `*Last ${recent.length} collection days*`,
      ""
    );

    recent.forEach((group) => {
      lines.push(
        `*${group.label}* — ${formatCurrency(group.subtotal)} · ${group.rows.length} contribution${
          group.rows.length === 1 ? "" : "s"
        }`
      );

      group.rows.forEach((row, index) => {
        const parts = [row.donorName, row.address].filter((part): part is string => Boolean(part));
        lines.push(`${index + 1}. ${parts.join(" - ")} - ${formatCurrency(row.total)}`);
      });

      lines.push("");
    });

    const total = sumDays(recent);
    const count = countRows(recent);
    const collected =
      recent.length === 1 ? "*Collected on this day:*" : `*Collected in these ${recent.length} days:*`;
    lines.push(
      `${collected} ${formatCurrency(total)} from ${count} contribution${count === 1 ? "" : "s"}`,
      ""
    );
  }

  lines.push(`_Generated ${generatedOn}_`);

  return lines.join("\n");
}
