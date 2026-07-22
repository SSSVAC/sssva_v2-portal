"use client";

import { useState } from "react";
import Link from "next/link";

type TopbarProps = {
  active: "dashboard" | "records" | "reports";
};

const NAV_LINKS = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "records", href: "/records", label: "Records" },
  { id: "reports", href: "/reports", label: "Reports" }
] as const;

export function Topbar({ active }: TopbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">S</span>
        <span>SSSVA Portal</span>
      </div>

      <button
        type="button"
        className="nav-toggle no-print"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`nav ${open ? "nav-open" : ""}`}>
        {NAV_LINKS.filter((link) => link.id !== active).map((link) => (
          <Link key={link.id} href={link.href} className="muted" onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <form action="/logout" method="post">
          <button className="button secondary" type="submit">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
