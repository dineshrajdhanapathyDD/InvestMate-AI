import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Candle } from "../types";
import { inr } from "../format";

export function PriceChart({ candles }: { candles: Candle[] }) {
  if (!candles.length) return null;
  const up = candles[candles.length - 1].close >= candles[0].close;
  const stroke = up ? "#1fae63" : "#e5544b";
  const data = candles.map((c) => ({ date: c.date, close: c.close }));

  return (
    <div className="h-64 w-full" aria-label="Historical closing price chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 11 }}
            minTickGap={40}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            width={56}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => inr(v)}
          />
          <Tooltip
            contentStyle={{
              background: "#0f1424",
              border: "1px solid #1e2740",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 12,
            }}
            formatter={(v: number) => [`₹${inr(v)}`, "Close"]}
          />
          <Area type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} fill="url(#fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
