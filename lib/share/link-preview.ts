export const SITE_NAME = "SSSVA Portal";

export type SharePreview = { title: string; description: string };

/**
 * The apps that fetch a URL to build a preview card. They are identified by
 * user agent because there is no other signal: a preview fetch is an
 * ordinary GET asking for HTML, indistinguishable from a person opening the
 * link except by who says they are.
 *
 * Getting this list wrong is not a security question — a crawler is served
 * strictly less than a visitor (a title, and no session) — it only decides
 * whether the preview card is specific or generic.
 */
const CRAWLERS = [
  "whatsapp",
  "facebookexternalhit",
  "facebookcatalog",
  "twitterbot",
  "slackbot",
  "slack-imgproxy",
  "telegrambot",
  "linkedinbot",
  "discordbot",
  "skypeuripreview",
  "signal",
  "googlebot",
  "bingbot",
  "embedly",
  "redditbot",
  "vkshare",
  "applebot",
  "pinterest"
];

export function isLinkPreviewCrawler(userAgent: string | null) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLERS.some((name) => ua.includes(name));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A minimal document carrying just the preview tags.
 *
 * Served to crawlers only, and it deliberately does NOT start a session or
 * count as a use — a preview being generated in a group chat is not somebody
 * opening the link, and counting it would make "last used" meaningless. The
 * meta refresh is a courtesy for anything that renders this page rather than
 * scraping it; a real browser never gets here.
 */
export function previewDocument(preview: SharePreview, url: string) {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  const safeUrl = escapeHtml(url);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} · ${SITE_NAME}</title>
<meta name="description" content="${description}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${safeUrl}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta http-equiv="refresh" content="0;url=${safeUrl}">
</head>
<body>${title}</body>
</html>`;
}
