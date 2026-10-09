import { useState } from "react";
import { api, ApiError } from "../api";
import type { PortfolioResult } from "../types";
import { EmptyState, Section, Skeleton } from "../components/ui";
import { inr, pct } from "../format";

interface Row {
  symbol: string;
  quantity: string;
  price: string;
}

const SEED: Row[] = [
  { symbol: "RELIANCE", quantity: "10", price: "" },
  { symbol: "TCS", quantity: "5", price: "" },
  { symbol: "HDFCBANK", quantity: "8", price: "" },
];

export function Portfolio() {
  const [rows, setRows] = useState<Row[]>(SEED);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, field: keyof Row, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { symbol: "", quantity: "", price: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function analyze() {
    const holdings = rows
      .filter((r) => r.symbol.trim() && Number(r.quantity) > 0)
      .map((r) => ({
        symbol: r.symbol.trim().toUpperCase(),
        quantity: Number(r.quantity),
        ...(r.price.trim() ? { price: Number(r.price) } : {}),
      }));
    if (!holdings.length) {
      setError("Add at least one holding with a positive quantity.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.portfolioRisk(holdings);
      setResult(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Portfolio risk explorer">
        <p className="text-sm text-slate-400 mb-3 leading-relaxed">
          Enter sample holdings to see allocation, concentration, and historical volatility. Leave
          price blank to use the latest available price. This does not place trades or ask for
          brokerage credentials.
        </p>
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_90px_110px_40px] gap-2 text-xs text-slate-500 px-1">
            <span>Symbol</span>
            <span>Quantity</span>
            <span>Price (optional)</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_110px_40px] gap-2">
              <input
                className="input tnum uppercase"
                value={r.symbol}
                onChange={(e) => update(i, "symbol", e.target.value)}
                placeholder="SYMBOL"
                aria-label={`Holding ${i + 1} symbol`}
              />
              <input
                className="input tnum"
                value={r.quantity}
                onChange={(e) => update(i, "quantity", e.target.value)}
                placeholder="Qty"
                inputMode="decimal"
                aria-label={`Holding ${i + 1} quantity`}
              />
              <input
                className="input tnum"
                value={r.price}
                onChange={(e) => update(i, "price", e.target.value)}
                placeholder="Auto"
                inputMode="decimal"
                aria-label={`Holding ${i + 1} price`}
              />
              <button
                className="btn-ghost px-0"
                onClick={() => removeRow(i)}
                aria-label={`Remove holding ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn-ghost" onClick={addRow}>
            Add holding
          </button>
          <button className="btn-primary" onClick={analyze} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze risk"}
          </button>
        </div>
        {error && <div className="text-down text-sm mt-2">{error}</div>}
      </Section>

      {loading ? (
        <Section title="Analysis">
          <Skeleton className="h-40 w-full" />
        </Section>
      ) : result ? (
        <Results result={result} />
      ) : (
        <Section title="Analysis">
          <EmptyState title="No analysis yet" hint="Enter holdings and select Analyze risk." />
        </Section>
      )}
    </div>
  );
}

function Results({ result }: { result: PortfolioResult }) {
  return (
    <div className="space-y-4">
      <Section
        title="Allocation and concentration"
        right={
          <span className={result.meta.isSample ? "badge-sample" : "badge-live"}>
            {result.meta.isSample ? "Demonstration data" : "Live data"}
          </span>
        }
      >
        <div className="text-sm text-slate-300 mb-3 tnum">
          Total value ₹{inr(result.totalValue)}
          {result.largestHolding && (
            <span className="text-slate-400">
              {"  "}| Largest: {result.largestHolding.symbol} ({pct(result.largestHolding.allocationPct)})
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tnum">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="py-1 pr-3 font-medium">Symbol</th>
                <th className="py-1 pr-3 font-medium text-right">Qty</th>
                <th className="py-1 pr-3 font-medium text-right">Price</th>
                <th className="py-1 pr-3 font-medium text-right">Value</th>
                <th className="py-1 pr-3 font-medium text-right">Alloc</th>
                <th className="py-1 font-medium text-right">Volatility</th>
              </tr>
            </thead>
            <tbody>
              {result.holdings.map((h) => (
                <tr key={h.symbol} className="border-t border-navy-800">
                  <td className="py-1 pr-3 text-slate-200">{h.symbol}</td>
                  <td className="py-1 pr-3 text-right">{h.quantity}</td>
                  <td className="py-1 pr-3 text-right">₹{inr(h.price)}</td>
                  <td className="py-1 pr-3 text-right">₹{inr(h.value)}</td>
                  <td className="py-1 pr-3 text-right">{pct(h.allocationPct)}</td>
                  <td className="py-1 text-right text-slate-400">
                    {h.annualizedVolatilityPct != null ? pct(h.annualizedVolatilityPct) : "n/a"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Sector allocation">
        <div className="space-y-2">
          {result.sectorAllocation.map((s) => (
            <div key={s.sector} className="flex items-center gap-3">
              <div className="w-28 text-xs text-slate-300">{s.sector}</div>
              <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${Math.min(100, s.allocationPct)}%` }} />
              </div>
              <div className="w-14 text-right text-xs tnum text-slate-400">{pct(s.allocationPct)}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What these numbers do and do not mean">
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400">
          {result.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
