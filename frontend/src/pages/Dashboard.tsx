import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../useAsync";
import { useApp } from "../store";
import type { History, IndexSnapshot, Meta, Quote } from "../types";
import { PriceChart } from "../components/PriceChart";
import { EmptyState, ErrorState, FreshnessChip, Section, Skeleton } from "../components/ui";
import { inr, moveClass, pct } from "../format";

export function Dashboard() {
  const navigate = useNavigate();
  const { watchlist } = useApp();
  const [focus, setFocus] = useState<string>("RELIANCE");

  const indices = useAsync(() => api.indices(), []);
  const history = useAsync(() => api.history(focus, "6M"), [focus]);

  return (
    <div className="space-y-4">
      <IndexStrip loading={indices.loading} error={indices.error} data={indices.data} meta={indices.meta as Meta} onRetry={indices.reload} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section
          title={`Historical price - ${focus}`}
          right={<FreshnessChip asOf={(history.meta as Meta)?.asOf} source={(history.meta as Meta)?.source} isSample={(history.meta as Meta)?.isSample} />}
        >
          {history.loading ? (
            <Skeleton className="h-64 w-full" />
          ) : history.error ? (
            <ErrorState message={history.error} onRetry={history.reload} />
          ) : history.data?.candles.length ? (
            <>
              <PriceChart candles={history.data.candles} />
              <HistoryStats history={history.data} />
            </>
          ) : (
            <EmptyState title="No historical data" hint="Try another symbol." />
          )}
        </Section>

        <Section title="Quick research">
          <p className="text-sm text-slate-400 mb-3 leading-relaxed">
            Ask InvestMate to explain a stock's movement with evidence and plain-language context.
          </p>
          <button className="btn-primary w-full" onClick={() => navigate("/research")}>
            Open AI Research
          </button>
          <div className="mt-4">
            <WatchlistQuotes symbols={watchlist} onOpen={setFocus} onBrowse={() => navigate("/search")} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function IndexStrip({
  loading,
  error,
  data,
  meta,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  data: IndexSnapshot[] | null;
  meta: Meta | null;
  onRetry: () => void;
}) {
  return (
    <Section title="Market indices" right={<FreshnessChip asOf={meta?.asOf} source={meta?.source} isSample={meta?.isSample} />}>
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(data || []).map((idx) => (
            <div key={idx.name} className="bg-navy-800 rounded-lg p-3">
              <div className="text-xs text-slate-400">{idx.name}</div>
              <div className="text-lg font-semibold tnum text-slate-100">{inr(idx.value)}</div>
              <div className={`text-xs tnum ${moveClass(idx.change)}`}>
                {inr(idx.change)} ({pct(idx.changePct)})
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function HistoryStats({ history }: { history: History }) {
  const m = history.metrics;
  if (!m) return null;
  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <Stat label="Period return" value={m.periodReturnPct != null ? pct(m.periodReturnPct) : "n/a"} tone={m.periodReturnPct} />
      <Stat label="High" value={`₹${inr(m.high)}`} />
      <Stat label="Low" value={`₹${inr(m.low)}`} />
      <Stat
        label="Volatility (ann.)"
        value={m.annualizedVolatilityPct != null ? pct(m.annualizedVolatilityPct) : "n/a"}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="bg-navy-800 rounded-lg p-2">
      <div className="text-slate-500">{label}</div>
      <div className={`font-medium tnum ${tone != null ? moveClass(tone) : "text-slate-200"}`}>{value}</div>
    </div>
  );
}

function WatchlistQuotes({
  symbols,
  onOpen,
  onBrowse,
}: {
  symbols: string[];
  onOpen: (s: string) => void;
  onBrowse: () => void;
}) {
  if (!symbols.length) {
    return (
      <div className="bg-navy-800 rounded-lg p-4 text-center">
        <div className="text-sm text-slate-300">Your watchlist is empty</div>
        <button className="btn-ghost mt-2" onClick={onBrowse}>
          Find stocks
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400">Watchlist</div>
      {symbols.slice(0, 6).map((s) => (
        <WatchRow key={s} symbol={s} onOpen={onOpen} />
      ))}
    </div>
  );
}

function WatchRow({ symbol, onOpen }: { symbol: string; onOpen: (s: string) => void }) {
  const q = useAsync<Quote>(() => api.quote(symbol), [symbol]);
  if (q.loading) return <Skeleton className="h-10" />;
  if (q.error || !q.data) return null;
  return (
    <button
      className="w-full flex items-center justify-between bg-navy-800 hover:bg-navy-700 rounded-lg px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      onClick={() => onOpen(symbol)}
    >
      <span className="tnum text-sm text-slate-200">{q.data.symbol}</span>
      <span className="flex items-center gap-2">
        <span className="tnum text-sm">₹{inr(q.data.lastPrice)}</span>
        <span className={`tnum text-xs ${moveClass(q.data.change)}`}>{pct(q.data.changePct)}</span>
      </span>
    </button>
  );
}
