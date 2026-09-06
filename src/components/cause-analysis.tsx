"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CauseCategorySummary, CauseYearSummary } from "@/lib/spill-causes";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 12,
};

const colors = {
  sabotage: "var(--brand)",
  equipment_failure: "var(--teal)",
  corrosion: "var(--warning)",
  operational: "#7c6ee6",
  yet_to_be_determined: "#9aa7a9",
  other: "#d97757",
};

export function CauseDistributionChart({ data }: { data: CauseCategorySummary[] }) {
  const chartData = data.filter((item) => item.category !== "missing" && item.count > 0).map((item) => ({
    category: item.label,
    records: item.count,
    fill: colors[item.category as keyof typeof colors] ?? "var(--brand)",
  }));
  return (
    <div className="analytics-card" role="img" aria-label="Horizontal bar chart showing reported cause categories in source records">
      <div className="analytics-card-head"><h2>National reported-cause distribution</h2><p>Counts are source-record classifications, not independent findings of fault.</p></div>
      <div className="chart-frame cause-chart-frame">
        <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 52)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 10, bottom: 4 }} accessibilityLayer>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="category" width={190} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toLocaleString("en-NG")} records`, "Reported cause"]} />
            <Bar dataKey="records" name="Source records" radius={[0, 4, 4, 0]} fill="var(--brand)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CauseTrendChart({ data }: { data: CauseYearSummary[] }) {
  return (
    <div className="analytics-card" role="img" aria-label="Line chart showing reported cause classifications by incident year">
      <div className="analytics-card-head"><h2>Reported causes over time</h2><p>Years use trusted incident dates; the latest year may be incomplete.</p></div>
      <div className="chart-frame cause-chart-frame">
        <ResponsiveContainer width="100%" height={390}>
          <LineChart data={data} margin={{ top: 12, right: 12, left: -14, bottom: 0 }} accessibilityLayer>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${Number(value).toLocaleString("en-NG")} records`, String(name).replaceAll("_", " ")]} />
            <Line type="monotone" dataKey="sabotage" name="Sabotage / theft" stroke={colors.sabotage} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="equipment_failure" name="Equipment failure" stroke={colors.equipment_failure} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="corrosion" name="Corrosion" stroke={colors.corrosion} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="operational" name="Operational/maintenance error" stroke={colors.operational} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="yet_to_be_determined" name="Yet to determine" stroke={colors.yet_to_be_determined} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="other" name="Other" stroke={colors.other} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
