import { describe, expect, it } from "vitest";
import { EMPTY_FILTER_VALUE, matchesColumnFilter } from "./column-filter";

describe("matchesColumnFilter", () => {
  it("passes every row when the filter is empty", () => {
    expect(matchesColumnFilter("number", 1500, "")).toBe(true);
    expect(matchesColumnFilter("text", null, "")).toBe(true);
  });

  describe("number columns", () => {
    it("matches the exact value, not the digits inside a bigger one", () => {
      expect(matchesColumnFilter("number", 500, "500")).toBe(true);
      expect(matchesColumnFilter("number", 1500, "500")).toBe(false);
      expect(matchesColumnFilter("number", 2500, "500")).toBe(false);
      expect(matchesColumnFilter("number", 500.5, "500")).toBe(false);
    });

    it("compares numerically, so trailing decimals don't hide a match", () => {
      // Postgres numeric(14,2) reaches the client as "500.00" often enough
      // that a string compare would miss the row the filter was typed for.
      expect(matchesColumnFilter("number", "500.00", "500")).toBe(true);
      expect(matchesColumnFilter("number", 500, "500.00")).toBe(true);
      expect(matchesColumnFilter("number", "1500.00", "500")).toBe(false);
    });

    it("does not treat an empty cell as zero", () => {
      expect(matchesColumnFilter("number", null, "0")).toBe(false);
      expect(matchesColumnFilter("number", undefined, "0")).toBe(false);
      expect(matchesColumnFilter("number", "", "0")).toBe(false);
      expect(matchesColumnFilter("number", 0, "0")).toBe(true);
    });

    it("matches nothing while the typed filter isn't a number yet", () => {
      expect(matchesColumnFilter("number", 500, "-")).toBe(false);
      expect(matchesColumnFilter("number", 500, "abc")).toBe(false);
    });

    it("finds a balance settled to zero, and a negative one", () => {
      expect(matchesColumnFilter("number", "0.00", "0")).toBe(true);
      expect(matchesColumnFilter("number", -250, "-250")).toBe(true);
    });
  });

  describe("the other column types", () => {
    it("still matches text on a substring", () => {
      expect(matchesColumnFilter("text", "Ponmuthu Nagar", "nagar")).toBe(true);
      expect(matchesColumnFilter("text", "Ponmuthu Nagar", "kalluri")).toBe(false);
    });

    it("still matches a date by prefix, so a month can be filtered", () => {
      expect(matchesColumnFilter("date", "2026-09-05", "2026-09")).toBe(true);
      expect(matchesColumnFilter("date", "2026-08-30", "2026-09")).toBe(false);
    });

    it("matches booleans on the state, not the text", () => {
      expect(matchesColumnFilter("boolean", true, "true")).toBe(true);
      expect(matchesColumnFilter("boolean", null, "false")).toBe(true);
      expect(matchesColumnFilter("boolean", true, "false")).toBe(false);
    });

    it("keeps the select column's explicit empty option", () => {
      expect(matchesColumnFilter("select", null, EMPTY_FILTER_VALUE)).toBe(true);
      expect(matchesColumnFilter("select", "", EMPTY_FILTER_VALUE)).toBe(true);
      expect(matchesColumnFilter("select", "Owner", EMPTY_FILTER_VALUE)).toBe(false);
      expect(matchesColumnFilter("select", "Owner", "Owner")).toBe(true);
    });
  });
});
