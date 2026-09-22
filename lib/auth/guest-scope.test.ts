import { describe, expect, it } from "vitest";
import { guestCanSeeReport, guestCanSeeReportCategory, guestCanAccessPath, isShareablePath } from "./guest-scope";

describe("what a guest may open", () => {
  it("keeps financial reports closed by default", () => {
    expect(guestCanSeeReportCategory("financial")).toBe(false);
    expect(guestCanSeeReport("financial", "monthly-report")).toBe(false);
    expect(guestCanSeeReport("financial", "member-monthly-donation")).toBe(false);
    expect(guestCanSeeReport("financial", "monthly-donors")).toBe(false);
  });

  it("opens the one financial report that withholds contact details", () => {
    // Its loader drops phone and area for a guest — see
    // lib/reports/definitions/financial/monthly-contributions.ts.
    expect(guestCanSeeReport("financial", "monthly-contributions")).toBe(true);
  });

  it("still opens the categories that were always open", () => {
    expect(guestCanSeeReport("silai", "silai-fund")).toBe(true);
    expect(guestCanSeeReport("events", "ugadi")).toBe(true);
  });

  it("says no to a report that doesn't exist", () => {
    expect(guestCanSeeReport("financial", "made-up")).toBe(false);
    expect(guestCanSeeReport("made-up", "monthly-contributions")).toBe(false);
  });
});

describe("isShareablePath", () => {
  it("accepts the guest areas and the opted-in report", () => {
    expect(isShareablePath("/reports/silai/silai-fund")).toBe(true);
    expect(isShareablePath("/functions")).toBe(true);
    expect(isShareablePath("/reports/financial/monthly-contributions")).toBe(true);
  });

  it("refuses the financial reports that carry personal data", () => {
    expect(isShareablePath("/reports/financial/monthly-report")).toBe(false);
    expect(isShareablePath("/reports/financial/monthly-donors")).toBe(false);
  });

  it("refuses anything that isn't a page a pass may be pinned to", () => {
    expect(isShareablePath("/records")).toBe(false);
    expect(isShareablePath("/settings")).toBe(false);
    expect(isShareablePath("https://example.com")).toBe(false);
    expect(isShareablePath("/reports/financial/monthly-contributions/../../records")).toBe(false);
  });
});

describe("guestCanAccessPath", () => {
  it("pins a share link to its one page", () => {
    const pass = "/reports/financial/monthly-contributions";

    expect(guestCanAccessPath(pass, pass)).toBe(true);
    expect(guestCanAccessPath(pass, "/reports/financial/monthly-report")).toBe(false);
    expect(guestCanAccessPath(pass, "/records")).toBe(false);
  });
});
