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

const SILAI_STATUS_COLORS: Record<string, string> = {
  not_paid: "var(--danger)",
  partially_paid: "var(--warning)",
  fully_paid: "var(--success)"
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2025-12" → "Dec 25" (axis) / "Dec 2025" (tooltip). Parsed by hand rather
// than through Date so no timezone can shift it into the previous month.
// Anything not in that shape is shown unchanged.
function monthLabel(value: string, long = false) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const name = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !name) return value;
  return `${name} ${long ? match[1] : match[1].slice(2)}`;
}

const COMPACT_CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1
});

export function IncomeSpendingChart({
  data
}: {
  data: { month: string; income: number; spending: number }[];
}) {
  if (data.every((point) => point.income === 0 && point.spending === 0)) {
    return (
      <div className="empty-state">
        <p>No income or spending recorded yet. Run a Zoho sync to populate it.</p>
      </div>
    );
  }

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={AXIS_TICK}
            tickFormatter={(value: string) => monthLabel(value)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value: number) => COMPACT_CURRENCY.format(value)}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "var(--row-hover)" }}
            labelFormatter={(label: string) => monthLabel(String(label), true)}
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
          />
          {/* Money in is a positive state, money out a caution — the semantic
              hues, not brand, since brand is reserved for things you click. */}
          <Bar dataKey="income" name="Income" fill="var(--success)" fillOpacity={0.8} activeBar={{ fillOpacity: 1 }} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="spending" name="Spending" fill="var(--warning)" fillOpacity={0.8} activeBar={{ fillOpacity: 1 }} radius={[4, 4, 0, 0]} maxBarSize={22} />
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
