"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { formatCurrency } from "@/lib/format";

const INVOICE_STATUS_COLORS = ["var(--primary)", "var(--accent)", "#2563eb", "#9333ea", "var(--muted)"];
const SILAI_STATUS_COLORS: Record<string, string> = {
  not_paid: "var(--danger)",
  partially_paid: "var(--accent)",
  fully_paid: "var(--success)"
};

const TOOLTIP_STYLE = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13
};

type DashboardChartsProps = {
  monthlyRevenue: {
    month: string;
    revenue: number;
  }[];
  invoiceStatus: {
    status: string;
    count: number;
  }[];
  silaiFundStatus: {
    status: string;
    label: string;
    count: number;
  }[];
};

export function DashboardCharts({ monthlyRevenue, invoiceStatus, silaiFundStatus }: DashboardChartsProps) {
  const hasSilaiData = silaiFundStatus.some((entry) => entry.count > 0);

  return (
    <>
      <div className="chart-panel">
        <div className="panel-head">
          <h2>Revenue Trend</h2>
          <span className="muted">Monthly</span>
        </div>
        <div className="chart-box">
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(value: number) => formatCurrency(value)}
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <p>No revenue data yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h2>Invoice Status</h2>
          <span className="muted">All invoices</span>
        </div>
        <div className="chart-box">
          {invoiceStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={invoiceStatus} dataKey="count" nameKey="status" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                  {invoiceStatus.map((entry, index) => (
                    <Cell key={entry.status} fill={INVOICE_STATUS_COLORS[index % INVOICE_STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <p>No invoice status data yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h2>Silai Fund Status</h2>
          <span className="muted">Members</span>
        </div>
        <div className="chart-box">
          {hasSilaiData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={silaiFundStatus} dataKey="count" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                  {silaiFundStatus.map((entry) => (
                    <Cell key={entry.status} fill={SILAI_STATUS_COLORS[entry.status] ?? "var(--muted)"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <p>No members tracked yet.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
