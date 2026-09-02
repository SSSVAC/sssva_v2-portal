import type { ReportCategory, ReportDefinition } from "./types";
import { monthlyReport } from "./definitions/financial/monthly-report";
import { memberMonthlyDonation } from "./definitions/financial/member-monthly-donation";
import { monthlyDonors } from "./definitions/financial/monthly-donors";
import { registration } from "./definitions/financial/registration";
import { silaiContributions } from "./definitions/silai/silai-contributions";
import { silaiFund } from "./definitions/silai/silai-fund";
import { silaiByGroup } from "./definitions/silai/silai-by-group";
import { silaiFollowup } from "./definitions/silai/silai-followup";
import { ugadi, varushabishegam, marghazhiPoojai } from "./definitions/events";

// Adding a report: write a ReportDefinition (loader + Component), push it
// here. Nothing else in the routing layer needs to change — see
// app/reports/[category]/[slug]/page.tsx.
export const REPORT_REGISTRY: ReportDefinition[] = [
  monthlyReport,
  memberMonthlyDonation,
  monthlyDonors,
  registration,
  silaiContributions,
  silaiFund,
  silaiByGroup,
  silaiFollowup,
  ugadi,
  varushabishegam,
  marghazhiPoojai
];

export function getReport(category: string, slug: string) {
  return REPORT_REGISTRY.find((report) => report.category === category && report.slug === slug);
}

export function getReportsByCategory(category: string) {
  return REPORT_REGISTRY.filter((report) => report.category === category);
}

// `label` is the full page title; `short` is the one-word family name used
// in the sidebar, breadcrumbs and category chips, where "Financial Reports"
// inside a list already headed "Reports" is just noise.
export const CATEGORY_META: Record<
  ReportCategory,
  { label: string; short: string; description: string }
> = {
  financial: {
    label: "Financial Reports",
    short: "Financial",
    description: "Monthly income, donations & donor activity"
  },
  silai: {
    label: "Silai Reports",
    short: "Silai",
    description: "Statue fund contributions & collection tracking"
  },
  events: {
    label: "Event Reports",
    short: "Events",
    description: "Annual festival funds, by year"
  }
};

export const CATEGORY_ORDER: ReportCategory[] = ["financial", "silai", "events"];
