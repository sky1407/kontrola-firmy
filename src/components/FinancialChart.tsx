"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatEur, formatEurCompact } from "@/lib/format";

export interface ChartPoint {
  label: string;
  revenue: number | null;
  netProfit: number | null;
  equity: number | null;
}

const SERIES_LABEL: Record<string, string> = {
  revenue: "Tržby",
  netProfit: "Výsledok hospodárenia",
  equity: "Vlastné imanie",
};

/** Tržby a zisk ako stĺpce, vlastné imanie ako čiara. `points` sú zoradené od najstaršieho roka. */
export function FinancialChart({ points }: { points: ChartPoint[] }) {
  return (
    <div className="h-80 w-full" role="img" aria-label="Graf tržieb, výsledku hospodárenia a vlastného imania podľa rokov">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.15} />
          <XAxis dataKey="label" tickLine={false} stroke="currentColor" />
          <YAxis tickFormatter={formatEurCompact} tickLine={false} axisLine={false} width={80} stroke="currentColor" />
          <Tooltip
            formatter={(value, name) => [typeof value === "number" ? formatEur(value) : "–", SERIES_LABEL[String(name)]]}
            contentStyle={{ borderRadius: 8 }}
            labelStyle={{ color: "#0f172a" }}
          />
          <Legend formatter={(name) => SERIES_LABEL[String(name)]} />
          <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Bar dataKey="netProfit" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Line dataKey="equity" stroke="#f59e0b" strokeWidth={2} dot connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
