import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ExposureBreakdownItem } from "@/types/risk";

const chartPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

function TooltipBox({ active, payload }: { active?: boolean; payload?: Array<{ payload: ExposureBreakdownItem }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 shadow-raised">
      <p className="text-xs font-semibold text-foreground">{item.label}</p>
      <p className="num text-xs text-muted-foreground">₹{item.amount} Cr · {item.riskLevel}</p>
    </div>
  );
}

/** Horizontal exposure bars with a distinct color per category. */
export function ExposureBarChart({
  data,
  height = 220,
  onSelect,
}: {
  data: ExposureBreakdownItem[];
  height?: number;
  onSelect?: (item: ExposureBreakdownItem) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--surface-muted)" }} />
        <Bar dataKey="amount" radius={[0, 3, 3, 0]} barSize={16} onClick={(d) => onSelect?.(d.payload as ExposureBreakdownItem)}>
          {data.map((item, index) => (
            <Cell key={item.key} fill={chartPalette[index % chartPalette.length]} cursor="pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertical columns — used for maturity ladders. */
export function ExposureColumnChart({
  data,
  height = 220,
}: {
  data: ExposureBreakdownItem[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--surface-muted)" }} />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]} barSize={38}>
          {data.map((item, index) => (
            <Cell key={item.key} fill={chartPalette[index % chartPalette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut split — used for product and country mix. */
export function ExposureDonutChart({
  data,
  height = 220,
}: {
  data: ExposureBreakdownItem[];
  height?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <ResponsiveContainer width="100%" height={height} className="max-w-[220px]">
        <PieChart>
          <Tooltip content={<TooltipBox />} />
          <Pie data={data} dataKey="amount" nameKey="label" innerRadius="58%" outerRadius="88%" paddingAngle={2}>
            {data.map((item, i) => (
              <Cell key={item.key} fill={chartPalette[i % chartPalette.length]} stroke="var(--surface)" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className="grid flex-1 gap-1.5">
        {data.map((item, i) => (
          <li key={item.key} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: chartPalette[i % chartPalette.length] }}
            />
            <span className="flex-1 truncate text-muted-foreground">{item.label}</span>
            <span className="num font-medium text-foreground">₹{item.amount} Cr</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
