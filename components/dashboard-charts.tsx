"use client";

import { formatCurrency } from "@/lib/format";

const STATUS_COLORS = ["var(--primary)", "var(--accent)", "#2563eb", "#9333ea", "var(--muted)"];

type DashboardChartsProps = {
  monthlyRevenue: {
    month: string;
    revenue: number;
  }[];
  invoiceStatus: {
    status: string;
    count: number;
  }[];
};

export function DashboardCharts({ monthlyRevenue, invoiceStatus }: DashboardChartsProps) {
  const maxRevenue = Math.max(...monthlyRevenue.map((item) => item.revenue), 1);
  const totalCount = Math.max(
    invoiceStatus.reduce((sum, item) => sum + item.count, 0),
    1
  );

  let offset = 0;

  return (
    <div className="dashboard-grid">
      <div className="chart-box">
        <div style={{ height: 260, display: "flex", alignItems: "flex-end", gap: 12 }}>
          {monthlyRevenue.length > 0 ? (
            monthlyRevenue.map((item) => {
              const height = Math.max(8, (item.revenue / maxRevenue) * 100);

              return (
                <div
                  key={item.month}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                >
                  <div style={{ height: 180, width: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div
                      style={{
                        width: "100%",
                        height: `${height}%`,
                        minHeight: 8,
                        backgroundColor: "var(--primary)",
                        borderRadius: "6px 6px 0 0"
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.month}</span>
                </div>
              );
            })
          ) : (
            <div style={{ width: "100%", textAlign: "center", color: "var(--muted)" }}>
              No revenue data yet.
            </div>
          )}
        </div>
      </div>

      <div className="chart-box">
        <div style={{ height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <svg width="220" height="220" viewBox="0 0 120 120" aria-label="Invoice status breakdown">
            <circle cx="60" cy="60" r="42" fill="none" stroke="var(--border)" strokeWidth="18" />
            {invoiceStatus.map((entry, index) => {
              const radius = 42;
              const circumference = 2 * Math.PI * radius;
              const segmentLength = (entry.count / totalCount) * circumference;
              const strokeDasharray = `${segmentLength} ${circumference - segmentLength}`;
              const strokeDashoffset = -offset;
              offset += segmentLength;

              return (
                <circle
                  key={entry.status}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={STATUS_COLORS[index % STATUS_COLORS.length]}
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 60 60)"
                />
              );
            })}
          </svg>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {invoiceStatus.length > 0 ? (
              invoiceStatus.map((entry, index) => (
                <div key={entry.status} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "999px",
                      backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length]
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {entry.status} ({entry.count})
                  </span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>No invoice status data yet.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
