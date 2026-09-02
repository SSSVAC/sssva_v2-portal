export function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

// Locale AND timezone are pinned. Leaving either to the runtime makes the
// same timestamp render differently on the server (UTC on Vercel) and in the
// browser (IST) — which shows staff a sync time five and a half hours out,
// and throws a hydration mismatch when the value is rendered on both sides.
const DATE_ZONE = "Asia/Kolkata";

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DATE_ZONE
  }).format(new Date(value));
}

export function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: DATE_ZONE
  }).format(new Date(value));
}
