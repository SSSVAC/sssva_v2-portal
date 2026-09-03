import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { requireViewerForPath, viewerChrome } from "@/lib/auth/viewer";
import { ShareLinkButton } from "@/components/share/share-link-button";
import { getFunctionSummaries } from "@/lib/functions/queries";
import { formatCurrency, formatDateOnly } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FunctionsPage() {
  const viewer = await requireViewerForPath("/functions");
  const functions = await getFunctionSummaries(viewer.supabase);

  return (
    <AppShell viewer={viewerChrome(viewer)} crumbs={[{ label: "Functions" }]}>
      <PageHeader
        title="Function arrangements"
        description="What each function needs, who has committed to it, and what it has cost so far."
        actions={
          viewer.isAdmin ? <ShareLinkButton path="/functions" title="Function arrangements" /> : undefined
        }
      />

      {functions.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <CalendarDays size={22} />
            <p>
              No functions yet. Run <code>supabase/seed-functions.sql</code> to load the
              Kumbabhishekam and Annathanam plans.
            </p>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {functions.map((fn) => {
            const covered =
              fn.itemCount > 0 ? Math.round((fn.sponsoredCount / fn.itemCount) * 100) : 0;
            const dates = [fn.starts_on, fn.ends_on].filter(Boolean).map((d) => formatDateOnly(d!));

            return (
              <Link
                key={fn.id}
                href={`/functions/${fn.slug}` as Route}
                className="gallery-card"
                style={{ ["--cat" as string]: "var(--cat-silai)" }}
              >
                <div className="gallery-card-head">
                  <span className="gallery-card-title">{fn.title}</span>
                  <ArrowRight size={15} className="gallery-card-arrow" />
                </div>
                {fn.subtitle && <div className="gallery-card-summary">{fn.subtitle}</div>}

                <div className="gallery-card-meta">
                  {dates.length > 0 ? dates.join(" – ") : fn.status}
                  <span aria-hidden="true">·</span>
                  {fn.sectionCount} sections
                  <span aria-hidden="true">·</span>
                  {fn.itemCount} items
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${covered}%` }} />
                  </div>
                  <div className="gallery-card-meta" style={{ marginTop: 6 }}>
                    {fn.sponsoredCount} of {fn.itemCount} covered
                    {fn.expected > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        {formatCurrency(fn.actual)} of {formatCurrency(fn.expected)}
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
