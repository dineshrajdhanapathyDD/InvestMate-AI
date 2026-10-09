import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../useAsync";
import { useApp } from "../store";
import type { History, IndexSnapshot, MarketMovers, Meta, Mover, Quote } from "../types";
import { PriceChart } from "../components/PriceChart";
import { EmptyState, ErrorState, FreshnessChip, Section, Skeleton } from "../components/ui";
import { inr, moveClass, pct } from "../format";

export function Dashboard() {
  const navigate = useNavigate();
  const { watchlist } = useApp();
  const [focus, setFocus] = useState<string>("RELIANCE");

  const indices = useAsync(() => api.indices(), []);
  const history = useAsync(() => api.history(focus, "6M"), [focus]);
  const movers = useAsync<MarketMovers>(() => api.marketMovers(), []);

  return (
    <div className="space-y-4">
      <IndexStrip loading={indices.loading} error={indices.error} data={indices.data} meta={indices.meta as Meta} onRetry={indices.reload} />

      <MoversRow
        loading={movers.loading}
        error={movers.error}
        data={movers.data}
        meta={movers.meta as Meta}
        onRetry={movers.reload}
        onOpen={setFocus}
      />

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

function MoversRow({
  loading,
  error,
  data,
  meta,
  onRetry,
  onOpen,
}: {
  loading: boolean;
  error: string | null;
  data: MarketMovers | null;
  meta: Meta | null;
  onRetry: () => void;
  onOpen: (s: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Section
        title="Top gainers"
        right={<FreshnessChip asOf={meta?.asOf} source={meta?.source} isSample={meta?.isSample} />}
      >
        <MoversList loading={loading} error={error} rows={data?.topGainers} onRetry={onRetry} onOpen={onOpen} />
      </Section>
      <Section title="Top losers">
        <MoversList loading={loading} error={error} rows={data?.topLosers} onRetry={onRetry} onOpen={onOpen} />
      </Section>
      <Section title="Market breadth">
        {loading ? (
          <Skeleton className="h-24" />
        ) : error || !data ? (
          <ErrorState message={error || "No data"} onRetry={onRetry} />
        ) : (
          <Breadth b={data.breadth} />
        )}
      </Section>
    </div>
  );
}

function MoversList({
  loading,
  error,
  rows,
  onRetry,
  onOpen,
}: {
  loading: boolean;
  error: string | null;
  rows?: Mover[];
  onRetry: () => void;
  onOpen: (s: string) => void;
}) {
  if (loading)
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  if (error || !rows) return <ErrorState message={error || "No data"} onRetry={onRetry} />;
  if (!rows.length) return <EmptyState title="No movers" />;
  return (
    <div className="space-y-1.5">
      {rows.map((m) => (
        <button
          key={m.symbol}
          className="w-full flex items-center justify-between bg-navy-800 hover:bg-navy-700 rounded-lg px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => onOpen(m.symbol)}
          title={m.name}
        >
          <span className="flex flex-col">
            <span className="tnum text-sm text-slate-200">{m.symbol}</span>
            <span className="text-[11px] text-slate-500 line-clamp-1">{m.name}</span>
          </span>
          <span className="flex flex-col items-end">
            <span className="tnum text-sm text-slate-200">&#8377;{inr(m.lastPrice)}</span>
            <span className={`tnum text-xs ${moveClass(m.changePct)}`}>{pct(m.changePct)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Breadth({ b }: { b: MarketMovers["breadth"] }) {
  const total = b.total || 1;
  const advPct = (b.advances / total) * 100;
  const decPct = (b.declines / total) * 100;
  const unchPct = 100 - advPct - decPct;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-navy-800">
        <div className="h-full bg-up" style={{ width: `${advPct}%` }} title={`${b.advances} advancing`} />
        <div className="h-full bg-slate-500" style={{ width: `${unchPct}%` }} title={`${b.unchanged} unchanged`} />
        <div className="h-full bg-down" style={{ width: `${decPct}%` }} title={`${b.declines} declining`} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-navy-800 rounded-lg p-2">
          <div className="text-slate-500">Advancing</div>
          <div className="tnum text-up font-medium">{b.advances}</div>
        </div>
        <div className="bg-navy-800 rounded-lg p-2">
          <div className="text-slate-500">Unchanged</div>
          <div className="tnum text-slate-300 font-medium">{b.unchanged}</div>
        </div>
        <div className="bg-navy-800 rounded-lg p-2">
          <div className="text-slate-500">Declining</div>
          <div className="tnum text-down font-medium">{b.declines}</div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Breadth across {b.total} tracked stocks. More advancing than declining suggests broad strength, and the reverse suggests weakness.
      </p>
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
