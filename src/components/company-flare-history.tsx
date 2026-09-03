"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HistoryPoint = { month: string } & Record<string, string | number>;

const lineStyles = [
  { stroke: "#147e78" },
  { stroke: "#d75c23", dash: "8 4" },
  { stroke: "#416d87", dash: "3 3" },
  { stroke: "#9a6d16", dash: "10 3 2 3" },
  { stroke: "#ae4a3d" },
  { stroke: "#735a91", dash: "6 3" },
  { stroke: "#36805b", dash: "2 3" },
  { stroke: "#5f6870", dash: "11 4" },
  { stroke: "#bd6b8c", dash: "4 3" },
  { stroke: "#287b9b", dash: "8 3 2 3" },
];

function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function CompanyFlareHistory({
  data,
  companies,
}: {
  data: HistoryPoint[];
  companies: string[];
}) {
  return (
    <div className="company-history-chart" aria-label="Historical monthly gas flare estimates by company">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            minTickGap={48}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            tickFormatter={(value) => String(value).endsWith("-01") ? String(value).slice(0, 4) : ""}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={48}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            tickFormatter={(value) => `${(Number(value) / 1_000_000).toFixed(0)}M`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            labelFormatter={(value) => monthLabel(String(value))}
            formatter={(value, name) => [
              `${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Number(value))} mscf`,
              String(name),
            ]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "var(--shadow)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          {companies.map((company, index) => {
            const style = lineStyles[index % lineStyles.length];
            return (
              <Line
                key={company}
                type="monotone"
                dataKey={company}
                name={company === "UNKNOWN" ? "Unknown" : company}
                stroke={style.stroke}
                strokeDasharray={style.dash}
                strokeWidth={index < 3 ? 2.4 : 1.8}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
