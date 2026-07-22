"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { ExportToolbar } from "@/components/export-toolbar";
import { SortableTh, type SortDirection } from "@/components/sortable-th";
import {
  exportSectionsToCsv,
  exportSectionsToHtml,
  exportSectionToImage,
  printReportSection,
  type ExportSection
} from "@/lib/export";

export type MemberStatus = "not_paid" | "partially_paid" | "fully_paid";

export type MemberRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  group: string | null;
  orderNumber: number | null;
  paid: number;
  balanceDue: number;
  status: MemberStatus;
};

type TabId = "all" | MemberStatus;
type SortKey = "name" | "phone" | "address" | "paid" | "balanceDue" | "status";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All Members" },
  { id: "not_paid", label: "Not Paid" },
  { id: "partially_paid", label: "Partially Paid" },
  { id: "fully_paid", label: "Fully Paid" }
];

const STATUS_LABEL: Record<MemberStatus, string> = {
  not_paid: "Not Paid",
  partially_paid: "Partially Paid",
  fully_paid: "Fully Paid"
};

const STATUS_CLASS: Record<MemberStatus, string> = {
  not_paid: "status-overdue",
  partially_paid: "status-sent",
  fully_paid: "status-paid"
};

type FundStatusTableProps = {
  members: MemberRow[];
  minimumAmount: number;
};

export function FundStatusTable({ members, minimumAmount }: FundStatusTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const counts = useMemo(
    () => ({
      all: members.length,
      not_paid: members.filter((member) => member.status === "not_paid").length,
      partially_paid: members.filter((member) => member.status === "partially_paid").length,
      fully_paid: members.filter((member) => member.status === "fully_paid").length
    }),
    [members]
  );

  const sortedMembers = useMemo(() => {
    const filtered = members.filter((member) => {
      if (activeTab !== "all" && member.status !== activeTab) return false;
      if (search && !member.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const direction = sortDirection === "asc" ? 1 : -1;

    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "phone":
          return (a.phone ?? "").localeCompare(b.phone ?? "") * direction;
        case "address":
          return (a.address ?? "").localeCompare(b.address ?? "") * direction;
        case "paid":
          return (a.paid - b.paid) * direction;
        case "balanceDue":
          return (a.balanceDue - b.balanceDue) * direction;
        case "status":
          return STATUS_LABEL[a.status].localeCompare(STATUS_LABEL[b.status]) * direction;
        default:
          return a.name.localeCompare(b.name) * direction;
      }
    });
  }, [members, activeTab, search, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const totalCollectedFromMembers = members.reduce((sum, member) => sum + member.paid, 0);
  const totalBalanceDue = members.reduce((sum, member) => sum + member.balanceDue, 0);

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Members", counts.all],
    ["Not Paid", counts.not_paid],
    ["Partially Paid", counts.partially_paid],
    ["Fully Paid", counts.fully_paid],
    ["Total Paid", formatCurrency(totalCollectedFromMembers)],
    ["Balance Due", formatCurrency(totalBalanceDue)]
  ];

  const exportHeaders = ["Name", "Phone", "Address", "Paid", "Balance Due", "Status"];
  const exportRows = () =>
    sortedMembers.map((member) => [
      member.name,
      member.phone ?? "",
      member.address ?? "",
      formatCurrency(member.paid),
      member.balanceDue > 0 ? formatCurrency(member.balanceDue) : "—",
      STATUS_LABEL[member.status]
    ]);

  const exportSections = (): ExportSection[] => [
    { title: "Metrics", headers: metricsExportHeaders, rows: metricsExportRows() },
    { title: "Members", headers: exportHeaders, rows: exportRows() }
  ];

  return (
    <div className="table-panel" style={{ minWidth: 0 }}>
      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv("members-silai-contributions.csv", exportSections())}
        onExportHtml={() => exportSectionsToHtml("members-silai-contributions.html", "Members Silai Contributions", exportSections())}
        onExportPdf={() => printReportSection("silai")}
        onExportImage={() => exportSectionToImage("silai", "members-silai-contributions.png")}
      />

      <div className="report-tablist no-print" role="tablist" aria-label="Member fund status">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            className={`report-tab ${activeTab === tab.id ? "report-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} ({counts[tab.id]})
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="filter-input no-print"
        style={{ maxWidth: 280, marginBottom: 16 }}
      />

      {sortedMembers.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh
                label="Name"
                active={sortKey === "name"}
                direction={sortDirection}
                onClick={() => toggleSort("name")}
              />
              <SortableTh
                label="Phone"
                active={sortKey === "phone"}
                direction={sortDirection}
                onClick={() => toggleSort("phone")}
              />
              <SortableTh
                label="Address"
                active={sortKey === "address"}
                direction={sortDirection}
                onClick={() => toggleSort("address")}
              />
              <SortableTh
                label="Paid"
                active={sortKey === "paid"}
                direction={sortDirection}
                onClick={() => toggleSort("paid")}
              />
              <SortableTh
                label="Balance Due"
                active={sortKey === "balanceDue"}
                direction={sortDirection}
                onClick={() => toggleSort("balanceDue")}
              />
              <SortableTh
                label="Status"
                active={sortKey === "status"}
                direction={sortDirection}
                onClick={() => toggleSort("status")}
              />
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.phone ?? "—"}</td>
                <td>{member.address ?? "—"}</td>
                <td>{formatCurrency(member.paid)}</td>
                <td>{member.balanceDue > 0 ? formatCurrency(member.balanceDue) : "—"}</td>
                <td>
                  <span className={`status-pill ${STATUS_CLASS[member.status]}`}>
                    {STATUS_LABEL[member.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-state">
          <p>No members match this filter.</p>
        </div>
      )}

      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        Minimum expected contribution: {formatCurrency(minimumAmount)} per member.
      </p>
    </div>
  );
}
