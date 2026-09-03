import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { ReportGalleryCard } from "@/components/reports/report-gallery-card";
import { CATEGORY_META, getReportsByCategory } from "@/lib/reports/registry";
import { CATEGORY_ACCENT, CATEGORY_ACCENT_SOFT } from "@/lib/nav";
import { requireViewerForPath, viewerChrome } from "@/lib/auth/viewer";
import { ShareLinkButton } from "@/components/share/share-link-button";
import { guestCanSeeReportCategory } from "@/lib/auth/guest-scope";
import type { ReportCategory } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ category: string }>;
};

export default async function ReportCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const viewer = await requireViewerForPath(`/reports/${category}`);
  const meta = CATEGORY_META[category as ReportCategory];
  const reports = getReportsByCategory(category);
  if (!meta || reports.length === 0) notFound();

  // 404 rather than a redirect: a guest shouldn't be able to tell an
  // off-limits family apart from one that doesn't exist.
  if (viewer.kind === "guest" && !guestCanSeeReportCategory(category)) notFound();

  return (
    <AppShell
      viewer={viewerChrome(viewer)}
      crumbs={[{ label: "Reports", href: "/reports" }, { label: meta.short }]}
    >
      <PageHeader
        title={meta.label}
        description={meta.description}
        actions={
          viewer.isAdmin && guestCanSeeReportCategory(category) ? (
            <ShareLinkButton path={`/reports/${category}`} title={meta.label} />
          ) : undefined
        }
        eyebrow={
          <span
            className="cat-chip"
            style={{
              ["--cat" as string]: CATEGORY_ACCENT[category as ReportCategory],
              ["--cat-soft" as string]: CATEGORY_ACCENT_SOFT[category as ReportCategory]
            }}
          >
            {reports.length} report{reports.length === 1 ? "" : "s"}
          </span>
        }
      />

      <div className="card-grid">
        {reports.map((report) => (
          <ReportGalleryCard key={report.slug} report={report} />
        ))}
      </div>
    </AppShell>
  );
}
