import { describe, expect, it } from "vitest";
import { isLinkPreviewCrawler, previewDocument } from "./link-preview";

describe("link preview crawler detection", () => {
  it("recognises the apps a temple link actually gets pasted into", () => {
    for (const ua of [
      "WhatsApp/2.23.20.0 A",
      "WhatsApp/2.2402.7 N",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Twitterbot/1.0",
      "TelegramBot (like TwitterBot)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0)"
    ]) {
      expect(isLinkPreviewCrawler(ua)).toBe(true);
    }
  });

  // A person opening the link must fall through to the real redirect; being
  // mistaken for a crawler would leave them staring at a blank page.
  it("does not mistake a real browser for a crawler", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ]) {
      expect(isLinkPreviewCrawler(ua)).toBe(false);
    }
  });

  it("treats a missing or empty user agent as a real visitor", () => {
    expect(isLinkPreviewCrawler(null)).toBe(false);
    expect(isLinkPreviewCrawler("")).toBe(false);
  });
});

describe("preview document", () => {
  const url = "https://portal.example/s/SSSVA-AAAA-BBBB-CCCC";

  it("carries the page's own name in the tags a chat app reads", () => {
    const html = previewDocument(
      { title: "Silai Fund Report", description: "All-time contributions, expenses & bills" },
      url
    );

    expect(html).toContain('<meta property="og:title" content="Silai Fund Report">');
    expect(html).toContain('<meta property="og:site_name" content="SSSVA Portal">');
    expect(html).toContain(`<meta property="og:url" content="${url}">`);
    expect(html).toContain("<title>Silai Fund Report · SSSVA Portal</title>");
  });

  // Report titles are edited in the app and function titles come from the
  // database, so both reach this unescaped.
  it("escapes titles and descriptions into the attributes", () => {
    const html = previewDocument(
      { title: 'Bills " & <Dues>', description: '<script>alert(1)</script>' },
      url
    );

    expect(html).toContain('content="Bills &quot; &amp; &lt;Dues&gt;"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps the ampersands in a real report description intact", () => {
    const html = previewDocument(
      { title: "Silai Fund Report", description: "Contributions, expenses & bills" },
      url
    );
    expect(html).toContain('content="Contributions, expenses &amp; bills"');
  });
});
