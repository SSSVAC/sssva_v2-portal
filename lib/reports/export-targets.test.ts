import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const COMPONENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "components");

const REPORTS_WITH_SECTION_EXPORTS = [
  "monthly-report.tsx",
  "silai-fund-report.tsx",
  "event-fund-report.tsx"
];

const SECTION_ID = /printId=\{sectionId\("([^"]+)"\)\}/;
const SECTION_EXPORT = /onExport(?:Pdf|Image)=\{(?:print|image)Part\("([^"]+)"\)\}/;

/**
 * A section's export menu must export that section.
 *
 * Every report section carries a printId and a menu whose Print and Image
 * handlers name the same part, twice over — six near-identical pairs down a
 * 600-line file. The Monthly Report's were off by one section: the toolbar's
 * "Export report" printed Income, Income's menu printed Donations, and so on
 * down to Bills, whose menu printed the whole report. Every export came out
 * as the wrong part of the report, and nothing failed to say so.
 *
 * Reading the source is a blunt way to check it, but the alternative is
 * mounting five reports to press two buttons in each, and the pairing is
 * right there in the markup.
 */
describe("report section exports", () => {
  REPORTS_WITH_SECTION_EXPORTS.forEach((file) => {
    it(`exports each section of ${file} from that section's own menu`, () => {
      const lines = readFileSync(join(COMPONENTS_DIR, file), "utf8").split("\n");

      let section: string | null = null;
      const mismatches: string[] = [];
      let checked = 0;

      lines.forEach((line, index) => {
        const declared = SECTION_ID.exec(line);
        if (declared) {
          section = declared[1];
          return;
        }

        const exported = SECTION_EXPORT.exec(line);
        if (!exported) return;

        checked += 1;
        if (exported[1] !== section) {
          mismatches.push(
            `${file}:${index + 1} — section "${section ?? "(none)"}" exports "${exported[1]}"`
          );
        }
      });

      expect(mismatches).toEqual([]);
      // A report that stopped using sectionId/printPart would otherwise pass
      // this test by having nothing to check.
      expect(checked).toBeGreaterThan(0);
    });
  });
});
