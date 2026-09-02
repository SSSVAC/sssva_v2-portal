import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { FunctionSectionCard } from "@/components/functions/function-section-card";
import { AddSectionButton } from "@/components/functions/add-section-button";
import { requireViewer, viewerChrome } from "@/lib/auth/viewer";
import { getFunctionDetail } from "@/lib/functions/queries";
import { formatCurrency, formatDateOnly } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function FunctionDetailPage({ params }: PageProps) {
  const viewer = await requireViewer();
  const { slug } = await params;

  const fn = await getFunctionDetail(viewer.supabase, slug);
  if (!fn) notFound();

  const canEdit = viewer.kind === "staff";
  const { totals } = fn;
  const covered = totals.itemCount > 0 ? Math.round((totals.sponsoredCount / totals.itemCount) * 100) : 0;
  const dates = [fn.starts_on, fn.ends_on].filter(Boolean).map((d) => formatDateOnly(d!));

  return (
    <AppShell
      viewer={viewerChrome(viewer)}
      crumbs={[{ label: "Functions", href: "/functions" }, { label: fn.title }]}
    >
      <div data-print-id={`function-${fn.slug}`}>
        <PageHeader
          title={fn.title}
          description={fn.description}
          eyebrow={
            <span className="cat-chip" style={{ ["--cat" as string]: "var(--cat-silai)", ["--cat-soft" as string]: "var(--cat-silai-soft)" }}>
              {dates.length > 0 ? dates.join(" – ") : fn.status}
            </span>
          }
          actions={canEdit ? <AddSectionButton functionId={fn.id} /> : undefined}
        />

        <div className="stack">
          {!canEdit && (
            <div className="viewer-banner no-print">
              <Eye size={15} />
              <span>
                You&apos;re viewing as a guest. Everything here is read-only.
              </span>
            </div>
          )}

          <div className="metric-grid" aria-label={`${fn.title} summary`}>
            <article className="metric-card" data-emphasis="lead">
              <div className="metric-head">
                <span>Items covered</span>
              </div>
              <div className="metric-value">
                {totals.sponsoredCount}
                <span className="muted" style={{ fontSize: "var(--fs-body)", fontWeight: 500 }}>
                  {" "}
                  / {totals.itemCount}
                </span>
              </div>
              <div className="metric-sub">{covered}% has an ubhayam against it</div>
            </article>

            <article className="metric-card" data-state={totals.openCount > 0 ? "warning" : "positive"}>
              <div className="metric-head">
                <span>Still open</span>
              </div>
              <div className="metric-value">{totals.openCount}</div>
              <div className="metric-sub">
                {totals.openCount > 0 ? "Nobody assigned yet" : "Every item is accounted for"}
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-head">
                <span>Expected</span>
              </div>
              <div className="metric-value">{formatCurrency(totals.expected)}</div>
              <div className="metric-sub">Across {totals.sectionCount} sections</div>
            </article>

            <article className="metric-card">
              <div className="metric-head">
                <span>Spent</span>
              </div>
              <div className="metric-value">{formatCurrency(totals.actual)}</div>
              <div className="metric-sub">
                {totals.expected > 0
                  ? `${Math.round((totals.actual / totals.expected) * 100)}% of expected`
                  : "No expected amounts entered yet"}
              </div>
            </article>
          </div>

          {fn.sections.length === 0 ? (
            <div className="panel">
              <div className="empty-state">
                <p>This function has no sections yet.</p>
              </div>
            </div>
          ) : (
            fn.sections.map((section) => (
              <FunctionSectionCard
                key={section.id}
                section={section}
                canEdit={canEdit}
                isAdmin={viewer.isAdmin}
              />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
