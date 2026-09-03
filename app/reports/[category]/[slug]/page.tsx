import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ReportShell } from "@/components/reports/report-shell";
import { CATEGORY_META, getReport, REPORT_REGISTRY } from "@/lib/reports/registry";
import { requireViewerForPath, viewerChrome } from "@/lib/auth/viewer";
import { ShareLinkButton } from "@/components/share/share-link-button";
import { guestCanSeeReportCategory } from "@/lib/auth/guest-scope";
import type { ReportCategory } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ category: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ReportPage({ params, searchParams }: PageProps) {
  // Auth always runs BEFORE the registry lookup, so an anonymous visitor
  // gets the same redirect for a valid slug and a typo. Don't reorder this.
  const { category, slug } = await params;
  const viewer = await requireViewerForPath(`/reports/${category}/${slug}`);
  const definition = getReport(category, slug);
  if (!definition) notFound();
  if (viewer.kind === "guest" && !guestCanSeeReportCategory(category)) notFound();

  const data = await definition.loader({
    supabase: viewer.supabase,
    searchParams: await searchParams
  });
  const Component = definition.Component;

  return (
    <AppShell
      viewer={viewerChrome(viewer)}
      crumbs={[
        { label: "Reports", href: "/reports" },
        { label: CATEGORY_META[definition.category].short, href: `/reports/${definition.category}` },
        { label: definition.title }
      ]}
    >
      <ReportShell
        category={definition.category}
        slug={definition.slug}
        title={definition.title}
        description={definition.description}
        actions={
          viewer.isAdmin && guestCanSeeReportCategory(category) ? (
            <ShareLinkButton path={`/reports/${category}/${slug}`} title={definition.title} />
          ) : undefined
        }
      >
        <Component {...data} />
      </ReportShell>
    </AppShell>
  );
}

export async function generateStaticParams() {
  return REPORT_REGISTRY.map((report) => ({
    category: report.category as ReportCategory,
    slug: report.slug
  }));
}
