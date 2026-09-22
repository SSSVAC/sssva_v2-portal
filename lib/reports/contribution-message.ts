import { formatCurrency } from "@/lib/format";
import type { MonthSummary, MonthlyContributionRow } from "@/lib/reports/monthly-contributions";

/**
 * Turns an Indian phone number as staff typed it into what wa.me expects:
 * digits only, country code included, no plus.
 *
 * Zoho carries numbers written every which way — "98765 43210",
 * "+91 98765-43210", "098765 43210". A number that still isn't a plausible
 * mobile after cleaning gets no link at all, rather than one that opens
 * WhatsApp on a wrong number.
 */
export function normalizeWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  let local: string | null = null;

  // 10-digit local number.
  if (digits.length === 10) local = digits;
  // Trunk-prefixed local number: drop the 0.
  else if (digits.length === 11 && digits.startsWith("0")) local = digits.slice(1);
  // Already carrying the country code, with or without the trunk 0.
  else if (digits.length === 12 && digits.startsWith("91")) local = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith("910")) local = digits.slice(3);

  // Indian mobile numbers start 6-9. A landline written in the phone field
  // would otherwise produce a link that opens WhatsApp on a number nobody
  // can receive a message on.
  if (!local || !/^[6-9]/.test(local)) return null;

  return `91${local}`;
}

/** A one-to-one WhatsApp chat with the message already typed. */
export function whatsAppLink(phone: string | null | undefined, message: string): string | null {
  const number = normalizeWhatsAppNumber(phone);
  if (!number) return null;

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function nameList(rows: MonthlyContributionRow[]) {
  return rows.map((row) => row.memberName).join(", ");
}

/**
 * The monthly update for the group: what came in, from how many, and who is
 * still outstanding. *bold* is WhatsApp's own markdown, as in the other
 * copy-for-WhatsApp exports.
 *
 * Amounts are named for the people who are short or haven't paid, because
 * that is the part of the message that asks for something. The settled
 * members are listed by name without amounts — everyone gave the same.
 */
export function buildContributionUpdate({
  monthLabel,
  summary,
  minimum
}: {
  monthLabel: string;
  summary: MonthSummary;
  minimum: number;
}): string {
  const total = summary.full.length + summary.partial.length + summary.none.length;
  const lines = [
    `*Monthly Contributions — ${monthLabel}*`,
    "",
    `*Collected:* ${formatCurrency(summary.collected)}`,
    `*Paid:* ${summary.full.length} of ${total} members`,
    ""
  ];

  if (summary.full.length > 0) {
    lines.push(`✅ *Paid ${formatCurrency(minimum)} or more (${summary.full.length})*`, nameList(summary.full), "");
  }

  if (summary.partial.length > 0) {
    lines.push(`⚠️ *Below ${formatCurrency(minimum)} (${summary.partial.length})*`);
    summary.partial.forEach((row) =>
      lines.push(`${row.memberName} — ${formatCurrency(row.amounts[summary.monthKey] ?? 0)}`)
    );
    lines.push("");
  }

  if (summary.none.length > 0) {
    lines.push(`❌ *Not yet paid (${summary.none.length})*`, nameList(summary.none), "");
  } else if (summary.partial.length === 0) {
    lines.push("Every member has paid this month. Thank you 🙏", "");
  }

  lines.push("_Sent from the SSSVA portal_");

  return lines.join("\n");
}

/**
 * The end-of-month nudge: the same month, but addressed to the people who
 * still owe it. Names only — an amount owed is the same for everyone, and a
 * public list of who paid what is not what a reminder is for.
 */
export function buildContributionFollowUp({
  monthLabel,
  summary,
  minimum
}: {
  monthLabel: string;
  summary: MonthSummary;
  minimum: number;
}): string {
  const outstanding = [...summary.none, ...summary.partial];

  if (outstanding.length === 0) {
    return [
      `*${monthLabel} contributions — all settled*`,
      "",
      `Every member has given this month's ${formatCurrency(minimum)}. Thank you 🙏`,
      "",
      "_Sent from the SSSVA portal_"
    ].join("\n");
  }

  return [
    `*Reminder — ${monthLabel} contributions*`,
    "",
    `A gentle reminder that this month's ${formatCurrency(minimum)} contribution is still pending for ${
      outstanding.length
    } member${outstanding.length === 1 ? "" : "s"}:`,
    "",
    nameList(outstanding),
    "",
    "If you have already paid, please ignore this message 🙏",
    "",
    "_Sent from the SSSVA portal_"
  ].join("\n");
}

/** The message a single member gets when chased directly. */
export function buildMemberReminder({
  memberName,
  monthLabel,
  minimum,
  paidSoFar
}: {
  memberName: string;
  monthLabel: string;
  minimum: number;
  paidSoFar: number;
}): string {
  const opening = `Namaskaram ${memberName},`;
  const ask =
    paidSoFar > 0
      ? `We have received ${formatCurrency(paidSoFar)} towards your ${monthLabel} contribution of ${formatCurrency(
          minimum
        )}. The balance of ${formatCurrency(minimum - paidSoFar)} is still pending.`
      : `This is a gentle reminder about your ${monthLabel} contribution of ${formatCurrency(minimum)}.`;

  return `${opening}\n\n${ask}\n\nThank you for your support 🙏\n— SSSVA`;
}
