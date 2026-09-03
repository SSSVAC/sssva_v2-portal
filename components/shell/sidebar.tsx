"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Database, Eye, KeyRound, LayoutDashboard, LogOut, PieChart } from "lucide-react";
import { CATEGORY_META, CATEGORY_ORDER, getReportsByCategory } from "@/lib/reports/registry";
import { CATEGORY_ACCENT, RECORD_TABLES } from "@/lib/nav";
import { guestCanSeeReportCategory } from "@/lib/auth/guest-scope";
import { formatDateOnly } from "@/lib/format";
import type { ViewerChrome } from "@/lib/auth/viewer";

type SidebarProps = {
  viewer: ViewerChrome;
  onNavigate: () => void;
};

// The whole navigation tree is visible at once: Functions, Overview, the four
// record tables, and every report grouped under its family. Two consequences
// that the old topbar got wrong — the current page is always highlighted
// rather than removed from the list, and every report is one click away
// instead of three.
//
// A guest sees only what lib/auth/guest-scope.ts allows. The nav is trimmed
// to match, so a guest is never shown a link that would bounce them; the
// pages themselves still enforce it, this is just not lying to them.
export function Sidebar({ viewer, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeRecordTab = searchParams.get("tab") ?? "customers";

  const isStaff = viewer.kind === "staff";
  // A share link opens exactly one page, so there is nothing to navigate to.
  const scoped = Boolean(viewer.scopePath);
  const onRecords = pathname.startsWith("/records");
  const onFunctions = pathname.startsWith("/functions");

  const categories = CATEGORY_ORDER.filter(
    (category) => isStaff || guestCanSeeReportCategory(category)
  );

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true">
          SV
        </span>
        <span className="brand-name">
          <strong>SSSVA</strong>
          <span>Portal</span>
        </span>
      </div>

      <nav className="sidebar-nav">
        {scoped && (
          <div className="nav-group">
            <span className="nav-item nav-item-active" aria-current="page">
              <Eye size={16} />
              Shared with you
            </span>
          </div>
        )}

        {!scoped && isStaff && (
          <div className="nav-group">
            <Link
              href="/dashboard"
              onClick={onNavigate}
              className={navClass(pathname === "/dashboard")}
              aria-current={pathname === "/dashboard" ? "page" : undefined}
            >
              <LayoutDashboard size={16} />
              Overview
            </Link>
          </div>
        )}

        {!scoped && (
        <div className="nav-group">
          <Link
            href="/functions"
            onClick={onNavigate}
            className={navClass(onFunctions)}
            aria-current={onFunctions ? "page" : undefined}
          >
            <CalendarDays size={16} />
            Functions
          </Link>
        </div>
        )}

        {!scoped && isStaff && (
          <div className="nav-group">
            <div className="nav-group-label">Records</div>
            <Link
              href="/records"
              onClick={onNavigate}
              className={navClass(onRecords)}
              aria-current={onRecords ? "page" : undefined}
            >
              <Database size={16} />
              All records
            </Link>
            <div className="nav-sub">
              {RECORD_TABLES.map((table) => {
                const active = onRecords && activeRecordTab === table.id;
                return (
                  <Link
                    key={table.id}
                    href={`/records?tab=${table.id}`}
                    onClick={onNavigate}
                    className={`${navClass(active)} nav-item-sub`}
                    aria-current={active ? "page" : undefined}
                  >
                    {table.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {!scoped && (
        <div className="nav-group">
          <div className="nav-group-label">Reports</div>
          <Link
            href="/reports"
            onClick={onNavigate}
            className={navClass(pathname === "/reports")}
            aria-current={pathname === "/reports" ? "page" : undefined}
          >
            <PieChart size={16} />
            All reports
          </Link>

          {categories.map((category) => {
            const reports = getReportsByCategory(category);
            const categoryHref = `/reports/${category}`;
            const categoryActive = pathname === categoryHref;

            return (
              <div key={category} style={{ marginTop: 6 }}>
                <Link
                  href={categoryHref as Route}
                  onClick={onNavigate}
                  className={navClass(categoryActive)}
                  aria-current={categoryActive ? "page" : undefined}
                >
                  <span
                    className="nav-dot"
                    style={{ ["--dot" as string]: CATEGORY_ACCENT[category] }}
                    aria-hidden="true"
                  />
                  {CATEGORY_META[category].short}
                  <span className="nav-count">{reports.length}</span>
                </Link>
                <div className="nav-sub">
                  {reports.map((report) => {
                    const href = `/reports/${report.category}/${report.slug}`;
                    const active = pathname === href;
                    return (
                      <Link
                        key={report.slug}
                        href={href as Route}
                        onClick={onNavigate}
                        className={`${navClass(active)} nav-item-sub`}
                        aria-current={active ? "page" : undefined}
                      >
                        {report.title.replace(/ Report$/, "")}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {viewer.isAdmin && (
          <div className="nav-group">
            <div className="nav-group-label">Admin</div>
            <Link
              href="/settings/access"
              onClick={onNavigate}
              className={navClass(pathname === "/settings/access")}
              aria-current={pathname === "/settings/access" ? "page" : undefined}
            >
              <KeyRound size={16} />
              Guest access
            </Link>
          </div>
        )}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <strong title={viewer.label}>{viewer.label}</strong>
          <span>
            {viewer.isGuest
              ? viewer.expiresAt
                ? `Guest until ${formatDateOnly(viewer.expiresAt)}`
                : "Guest · view only"
              : viewer.isAdmin
                ? "Administrator"
                : "Staff"}
          </span>
        </div>
        <form action="/logout" method="post">
          <button className="btn btn-secondary btn-sm" type="submit" style={{ width: "100%" }}>
            <LogOut size={14} />
            {viewer.isGuest ? "Leave" : "Sign out"}
          </button>
        </form>
      </div>
    </aside>
  );
}

function navClass(active: boolean) {
  return `nav-item${active ? " nav-item-active" : ""}`;
}
