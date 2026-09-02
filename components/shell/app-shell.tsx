"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Menu } from "lucide-react";
import { Sidebar } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import type { ViewerChrome } from "@/lib/auth/viewer";

export type Crumb = { label: string; href?: string };

type AppShellProps = {
  viewer: ViewerChrome;
  crumbs?: Crumb[];
  children: ReactNode;
};

// One shell for every signed-in page: persistent sidebar, a thin appbar
// carrying only "where am I" plus global controls, and a width-capped
// content column. Pages supply their own <PageHeader> inside `children`.
export function AppShell({ viewer, crumbs = [], children }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={`app${navOpen ? " sidebar-open" : ""}`}>
      <Suspense fallback={<div className="sidebar" />}>
        <Sidebar viewer={viewer} onNavigate={() => setNavOpen(false)} />
      </Suspense>

      {navOpen && (
        <button
          type="button"
          className="sidebar-backdrop no-print"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div>
        <header className="appbar no-print">
          <button
            type="button"
            className="nav-toggle"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Menu size={18} />
          </button>

          {crumbs.length > 0 && (
            <nav className="appbar-crumbs" aria-label="Breadcrumb">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <span key={`${crumb.label}-${index}`} style={{ display: "contents" }}>
                    {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
                    {crumb.href && !last ? (
                      <Link href={crumb.href as Route}>{crumb.label}</Link>
                    ) : (
                      <span className={last ? "crumb-current" : undefined}>{crumb.label}</span>
                    )}
                  </span>
                );
              })}
            </nav>
          )}

          <div className="appbar-actions">
            {viewer.isGuest && (
              <span className="pill pill-info" title="Read-only access">
                Guest · view only
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="content">{children}</div>
      </div>
    </div>
  );
}
