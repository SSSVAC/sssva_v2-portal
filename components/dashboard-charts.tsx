"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCurrency } from "@/lib/format";

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow-md)",
  color: "var(--text)",
  fontSize: 12
};

const AXIS_TICK = { fontSize: 11, fill: "var(--text-muted)" };

// Status colour is derived from what the status MEANS, not from where the
// slice happens to fall in the array. The old chart cycled a five-colour
// array by index, so "paid" could come out purple on one deployment and
// teal on the next depending only on which statuses existed in the data.
function invoiceStatusColor(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("overdue") || normalized === "void") return "var(--danger)";
  if (normalized.includes("paid") && !normalized.includes("partially")) return "var(--success)";
  if (normalized.includes("partially")) return "var(--warning)";
  if (normalized === "sent") return "var(--info)";
  return "var(--border-strong)";
}

const SILAI_STATUS_COLORS: Record<string, string> = {
  not_paid: "var(--danger)",
  partially_paid: "var(--warning)",
  fully_paid: "var(--success)"
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function RevenueTrendChart({
  data
}: {
  data: { month: string; revenue: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p>No revenue data yet. Run a Zoho sync to populate it.</p>
      </div>
    );
  }

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value: number) => formatCurrency(value)}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={78}
          />
          <Tooltip
            cursor={{ fill: "var(--row-hover)" }}
            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar dataKey="revenue" fill="var(--brand)" radius={[5, 5, 0, 0]} maxBarSize={46} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutChart({
  data,
  emptyMessage
}: {
  data: { key: string; label: string; count: number; color: string }[];
  emptyMessage: string;
}) {
  if (data.length === 0 || data.every((entry) => entry.count === 0)) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="chart-box chart-box-sm">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InvoiceStatusChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <DonutChart
      emptyMessage="No invoice status data yet."
      data={data.map((entry) => ({
        key: entry.status,
        label: titleCase(entry.status),
        count: entry.count,
        color: invoiceStatusColor(entry.status)
      }))}
    />
  );
}

export function SilaiStatusChart({
  data
}: {
  data: { status: string; label: string; count: number }[];
}) {
  return (
    <DonutChart
      emptyMessage="No members tracked yet."
      data={data.map((entry) => ({
        key: entry.status,
        label: entry.label,
        count: entry.count,
        color: SILAI_STATUS_COLORS[entry.status] ?? "var(--border-strong)"
      }))}
    />
  );
}
