"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  Database,
  Eye,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PieChart
} from "lucide-react";
import { CATEGORY_META, CATEGORY_ORDER, getReportsByCategory } from "@/lib/reports/registry";
import { CATEGORY_ACCENT, RECORD_TABLES } from "@/lib/nav";
import { guestCanSeeReportCategory } from "@/lib/auth/guest-scope";
import { formatDateOnly } from "@/lib/format";
import type { ViewerChrome } from "@/lib/auth/viewer";

type SidebarProps = {
  viewer: ViewerChrome;
  onNavigate: () => void;
};

// Every page is reachable from here, but not every page is listed at once.
// The record tables and each report family are branches: the branch holding
// the current page is open, the rest are folded to a single row with a
// caret. Fully expanded, the tree was ~26 rows and pushed the Silai and
// Events reports below the fold on a laptop, while the Records page already
// repeats its four tables as tabs. The current page is still always visible
// and highlighted — that was the reason for the sidebar over the old topbar.
//
// A guest sees only what lib/auth/guest-scope.ts allows. The nav is trimmed
// to match, so a guest is never shown a link that would bounce them; the
// pages themselves still enforce it, this is just not lying to them.
export function Sidebar({ viewer, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeRecordTab = searchParams.get("tab") ?? "customers";

  // Only the user's explicit choices are stored; anything they haven't
  // touched follows the current route, so moving to another family's
  // report opens that family without any effect hook.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (key: string, containsCurrent: boolean) => expanded[key] ?? containsCurrent;
  const toggle = (key: string, containsCurrent: boolean) =>
    setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? containsCurrent) }));

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

        {!scoped && (
          <div className="nav-group">
            {isStaff && (
              <NavLink href="/dashboard" active={pathname === "/dashboard"} onNavigate={onNavigate}>
                <LayoutDashboard size={16} />
                Overview
              </NavLink>
            )}
            <NavLink href="/functions" active={onFunctions} onNavigate={onNavigate}>
              <CalendarDays size={16} />
              Functions
            </NavLink>
          </div>
        )}

        {!scoped && isStaff && (
          <div className="nav-group">
            <div className="nav-group-label">Records</div>
            <NavBranch
              id="nav-records"
              open={isOpen("records", onRecords)}
              onToggle={() => toggle("records", onRecords)}
              label="record tables"
              row={
                <NavLink href="/records" active={onRecords} onNavigate={onNavigate}>
                  <Database size={16} />
                  All records
                </NavLink>
              }
            >
              {RECORD_TABLES.map((table) => (
                <NavLink
                  key={table.id}
                  href={`/records?tab=${table.id}`}
                  active={onRecords && activeRecordTab === table.id}
                  onNavigate={onNavigate}
                  sub
                >
                  {table.label}
                </NavLink>
              ))}
            </NavBranch>
          </div>
        )}

        {!scoped && (
          <div className="nav-group">
            <div className="nav-group-label">Reports</div>
            <NavLink href="/reports" active={pathname === "/reports"} onNavigate={onNavigate}>
              <PieChart size={16} />
              All reports
            </NavLink>

            {categories.map((category) => {
              const reports = getReportsByCategory(category);
              const categoryHref = `/reports/${category}`;
              const inCategory = pathname === categoryHref || pathname.startsWith(`${categoryHref}/`);

              return (
                <NavBranch
                  key={category}
                  id={`nav-${category}`}
                  open={isOpen(category, inCategory)}
                  onToggle={() => toggle(category, inCategory)}
                  label={`${CATEGORY_META[category].short} reports`}
                  row={
                    <NavLink
                      href={categoryHref}
                      active={pathname === categoryHref}
                      onNavigate={onNavigate}
                    >
                      <span
                        className="nav-dot"
                        style={{ ["--dot" as string]: CATEGORY_ACCENT[category] }}
                        aria-hidden="true"
                      />
                      {CATEGORY_META[category].short}
                      <span className="nav-count">{reports.length}</span>
                    </NavLink>
                  }
                >
                  {reports.map((report) => {
                    const href = `/reports/${report.category}/${report.slug}`;
                    return (
                      <NavLink
                        key={report.slug}
                        href={href}
                        active={pathname === href}
                        onNavigate={onNavigate}
                        sub
                      >
                        {report.title.replace(/ Report$/, "")}
                      </NavLink>
                    );
                  })}
                </NavBranch>
              );
            })}
          </div>
        )}

        {viewer.isAdmin && (
          <div className="nav-group">
            <div className="nav-group-label">Admin</div>
            <NavLink
              href="/settings/access"
              active={pathname === "/settings/access"}
              onNavigate={onNavigate}
            >
              <KeyRound size={16} />
              Guest access
            </NavLink>
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

function NavLink({
  href,
  active,
  onNavigate,
  sub = false,
  children
}: {
  href: string;
  active: boolean;
  onNavigate: () => void;
  sub?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      onClick={onNavigate}
      className={`nav-item${sub ? " nav-item-sub" : ""}${active ? " nav-item-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

// A parent row that is itself a link, plus a separate caret that folds its
// children. Two controls rather than one, so clicking "Silai" still opens
// the Silai gallery and folding a branch never navigates.
function NavBranch({
  id,
  open,
  onToggle,
  label,
  row,
  children
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  label: string;
  row: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="nav-branch">
      <div className="nav-branch-row">
        {row}
        <button
          type="button"
          className="nav-caret"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${open ? "Hide" : "Show"} ${label}`}
          onClick={onToggle}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div id={id} className="nav-sub" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
