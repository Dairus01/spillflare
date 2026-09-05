"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { YearlySpillCount } from "@/lib/spill-overview";

const integer = new Intl.NumberFormat("en-NG");

export function NationalSpillTrend({ data }: { data: YearlySpillCount[] }) {
  return (
    <div className="national-trend-chart" role="img" aria-label={`Bar chart of Nigerian oil spill records by year from ${data[0]?.year ?? "the first supplied year"} to ${data.at(-1)?.year ?? "the latest supplied year"}`}>
      <ResponsiveContainer width="100%" height={330}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 2 }} accessibilityLayer>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="year" interval="preserveStartEnd" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--ink)", fontSize: 12 }}
            formatter={(value) => [`${integer.format(Number(value))} records`, "Dated records"]}
          />
          <Bar dataKey="count" name="Dated records" fill="var(--brand)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
