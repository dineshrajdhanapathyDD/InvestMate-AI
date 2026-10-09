import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAsync } from "../useAsync";
import type { History, Meta } from "../types";
import { PriceChart } from "../components/PriceChart";
import { EmptyState, ErrorState, FreshnessChip, Section, Skeleton } from "../components/ui";
import { inr, moveClass, num, pct } from "../format";

const PERIODS = ["1W", "1M", "3M", "6M", "1Y", "5Y"];

export function HistoricalData() {
  const [params] = useSearchParams();
  const initial = (params.get("symbol") || "TCS").toUpperCase();
  const [symbol, setSymbol] = useState(initial);
  const [input, setInput] = useState(initial);
  const [period, setPeriod] = useState("1Y");

  const history = useAsync<History>(() => api.history(symbol, period), [symbol, period]);
  const meta = history.meta as Meta | null;

  return (
    <div className="space-y-4">
      <Section title="Historical market data">
        <div className="flex flex-wrap gap-2 items-end">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) setSymbol(input.trim().toUpperCase());
            }}
          >
            <div>
              <label htmlFor="hsym" className="block text-xs text-slate-400 mb-1">
                Symbol
              </label>
              <input
                id="hsym"
                className="input tnum uppercase w-40"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <button className="btn-primary self-end">Load</button>
          </form>
          <div className="flex gap-1 ml-auto" role="group" aria-label="Select period">
            {PERIODS.map((p) => (
              <button
                key={p}
                className={`btn ${period === p ? "bg-accent text-white" : "btn-ghost"}`}
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title={`${symbol} - ${period}`}
        right={<FreshnessChip asOf={meta?.asOf} source={meta?.source} isSample={meta?.isSample} />}
      >
        {history.loading ? (
          <Skeleton className="h-64 w-full" />
        ) : history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : history.data?.candles.length ? (
          <>
            <PriceChart candles={history.data.candles} />
            <Metrics history={history.data} />
            <DataTable history={history.data} />
          </>
        ) : (
          <EmptyState title="No data for this selection" />
        )}
      </Section>
    </div>
  );
}

function Metrics({ history }: { history: History }) {
  const m = history.metrics;
  if (!m) return null;
  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
      <Cell label="Observations" value={num(m.observations)} />
      <Cell label="Return" value={m.periodReturnPct != null ? pct(m.periodReturnPct) : "n/a"} tone={m.periodReturnPct} />
      <Cell label="High" value={`₹${inr(m.high)}`} />
      <Cell label="Low" value={`₹${inr(m.low)}`} />
      <Cell label="Avg volume" value={num(m.avgVolume)} />
      {!m.volatilitySufficient && (
        <div className="col-span-full text-slate-500">{m.volatilityNote}</div>
      )}
      {m.volatilitySufficient && (
        <Cell label="Volatility (annualized)" value={pct(m.annualizedVolatilityPct)} />
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="bg-navy-800 rounded-lg p-2">
      <div className="text-slate-500">{label}</div>
      <div className={`font-medium tnum ${tone != null ? moveClass(tone) : "text-slate-200"}`}>{value}</div>
    </div>
  );
}

function DataTable({ history }: { history: History }) {
  const rows = history.candles.slice(-12).reverse();
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="text-xs text-slate-400 mb-2">Most recent sessions</div>
      <table className="w-full text-xs tnum">
        <thead className="text-slate-500 text-left">
          <tr>
            <th className="py-1 pr-3 font-medium">Date</th>
            <th className="py-1 pr-3 font-medium text-right">Open</th>
            <th className="py-1 pr-3 font-medium text-right">High</th>
            <th className="py-1 pr-3 font-medium text-right">Low</th>
            <th className="py-1 pr-3 font-medium text-right">Close</th>
            <th className="py-1 font-medium text-right">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.date} className="border-t border-navy-800">
              <td className="py-1 pr-3 text-slate-300">{c.date}</td>
              <td className="py-1 pr-3 text-right">{inr(c.open)}</td>
              <td className="py-1 pr-3 text-right">{inr(c.high)}</td>
              <td className="py-1 pr-3 text-right">{inr(c.low)}</td>
              <td className="py-1 pr-3 text-right">{inr(c.close)}</td>
              <td className="py-1 text-right text-slate-400">{num(c.volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
