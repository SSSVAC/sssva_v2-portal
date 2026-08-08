import { notFound } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { ReportShell } from "@/components/reports/report-shell";
import { getReport, REPORT_REGISTRY } from "@/lib/reports/registry";
import { requireAuthedSupabase } from "@/lib/reports/require-auth";
import type { ReportCategory } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ category: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ReportPage({ params, searchParams }: PageProps) {
  const supabase = await requireAuthedSupabase();

  const { category, slug } = await params;
  const definition = getReport(category, slug);
  if (!definition) notFound();

  const data = await definition.loader({ supabase, searchParams: await searchParams });
  const Component = definition.Component;

  return (
    <main className="shell">
      <Topbar active="reports" />
      <div className="main">
        <ReportShell category={definition.category} slug={definition.slug} title={definition.title} description={definition.description}>
          <Component {...data} />
        </ReportShell>
      </div>
    </main>
  );
}

export async function generateStaticParams() {
  return REPORT_REGISTRY.map((report) => ({ category: report.category as ReportCategory, slug: report.slug }));
}
