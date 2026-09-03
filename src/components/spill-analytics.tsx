"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompanyAnalyticsRow, MonthlyAnalyticsRow } from "@/lib/spill-analytics";

type SortKey = keyof Pick<CompanyAnalyticsRow, "company" | "reportedSpills" | "reportedVolume" | "noJiv" | "noQuantity">;
type SortDirection = "asc" | "desc";

const integer = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
const volume = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 12,
};

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function SortButton({ label, column, active, direction, onSort }: { label: string; column: SortKey; active: boolean; direction: SortDirection; onSort: (column: SortKey) => void }) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button className="table-sort" type="button" onClick={() => onSort(column)} aria-label={`Sort by ${label}`}>
      {label}<Icon size={12} aria-hidden="true" />
    </button>
  );
}

export function CompanyPerformanceTable({ rows }: { rows: CompanyAnalyticsRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("reportedSpills");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const result = typeof left === "string" ? left.localeCompare(String(right)) : left - Number(right);
    return direction === "asc" ? result : -result;
  }), [rows, sortKey, direction]);

  function sort(column: SortKey) {
    if (column === sortKey) setDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(column);
      setDirection(column === "company" ? "asc" : "desc");
    }
  }

  return (
    <div className="table-wrap analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            <th aria-sort={sortKey === "company" ? (direction === "asc" ? "ascending" : "descending") : "none"}><SortButton label="Company" column="company" active={sortKey === "company"} direction={direction} onSort={sort} /></th>
            <th className="numeric" aria-sort={sortKey === "reportedSpills" ? (direction === "asc" ? "ascending" : "descending") : "none"}><SortButton label="Reported spills" column="reportedSpills" active={sortKey === "reportedSpills"} direction={direction} onSort={sort} /></th>
            <th className="numeric" aria-sort={sortKey === "reportedVolume" ? (direction === "asc" ? "ascending" : "descending") : "none"}><SortButton label="Estimated quantity" column="reportedVolume" active={sortKey === "reportedVolume"} direction={direction} onSort={sort} /></th>
            <th className="numeric" aria-sort={sortKey === "noJiv" ? (direction === "asc" ? "ascending" : "descending") : "none"}><SortButton label="No JIV date" column="noJiv" active={sortKey === "noJiv"} direction={direction} onSort={sort} /></th>
            <th className="numeric" aria-sort={sortKey === "noQuantity" ? (direction === "asc" ? "ascending" : "descending") : "none"}><SortButton label="No quantity" column="noQuantity" active={sortKey === "noQuantity"} direction={direction} onSort={sort} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.company}>
              <td><strong>{row.company}</strong></td>
              <td className="numeric">{integer.format(row.reportedSpills)}</td>
              <td className="numeric"><strong>{volume.format(row.reportedVolume)} bbl</strong><small>{row.quantitySupplied} of {row.reportedSpills} rows supplied quantity</small></td>
              <td className="numeric">{percentage(row.noJiv, row.reportedSpills)}% <span>({row.noJiv})</span></td>
              <td className="numeric">{percentage(row.noQuantity, row.reportedSpills)}% <span>({row.noQuantity})</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="analytics-card">
      <div className="analytics-card-head"><div><h2>{title}</h2><p>{description}</p></div></div>
      <div className="chart-frame">{children}</div>
    </section>
  );
}

export function SpillAnalyticsCharts({ monthly, states }: { monthly: MonthlyAnalyticsRow[]; states: Array<{ name: string; value: number }> }) {
  return (
    <div className="analytics-charts">
      <ChartFrame title="Number of reported spills by cause" description="Monthly incident rows grouped from the source cause codes.">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={monthly} margin={{ top: 12, right: 12, left: -14, bottom: 0 }} accessibilityLayer>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${integer.format(Number(value))} spills`]} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Bar dataKey="sabotage" name="Sabotage / theft" fill="var(--brand)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="operational" name="Operational issues" fill="var(--teal)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="other" name="Other / unspecified" fill="var(--muted)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="Estimated quantity by reported cause" description="Monthly sum in barrels only where the source supplies an estimated quantity.">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={monthly} margin={{ top: 12, right: 18, left: 6, bottom: 0 }} accessibilityLayer>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => integer.format(Number(value))} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${volume.format(Number(value))} bbl`]} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Line dataKey="sabotageVolume" name="Sabotage / theft" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} type="monotone" />
            <Line dataKey="operationalVolume" name="Operational issues" stroke="var(--teal)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} type="monotone" />
            <Line dataKey="otherVolume" name="Other / unspecified" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="States with the most reported spills" description="Top ten state labels in the selected year; offshore records retain the source state field.">
        <ResponsiveContainer width="100%" height={390}>
          <BarChart data={states} layout="vertical" margin={{ top: 5, right: 24, left: 28, bottom: 0 }} accessibilityLayer>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={92} tick={{ fill: "var(--slate)", fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${integer.format(Number(value))} spills`, "Reported incidents"]} />
            <Bar dataKey="value" name="Reported incidents" fill="var(--brand)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="Quantity reporting completeness" description="A missing quantity means not supplied—not zero barrels.">
        <ResponsiveContainer width="100%" height={390}>
          <BarChart data={monthly} margin={{ top: 12, right: 12, left: -14, bottom: 0 }} accessibilityLayer>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${integer.format(Number(value))} records`]} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Bar dataKey="quantitySupplied" stackId="quantity" name="Quantity supplied" fill="var(--teal)" />
            <Bar dataKey="quantityMissing" stackId="quantity" name="Quantity not supplied" fill="var(--warning)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
