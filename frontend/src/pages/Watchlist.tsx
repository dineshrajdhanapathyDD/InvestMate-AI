import { useApp } from "../store";
import { api } from "../api";
import { useAsync } from "../useAsync";
import type { Quote } from "../types";
import { QuoteCard } from "../components/QuoteCard";
import { EmptyState, Section, Skeleton } from "../components/ui";
import { useNavigate } from "react-router-dom";

export function Watchlist() {
  const { watchlist } = useApp();
  const navigate = useNavigate();

  return (
    <Section title={`Watchlist (${watchlist.length})`}>
      {watchlist.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          hint="Star a stock from search or the dashboard to track it here."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {watchlist.map((s) => (
              <WatchlistCard key={s} symbol={s} />
            ))}
          </div>
          <button className="btn-ghost mt-4" onClick={() => navigate("/search")}>
            Add more
          </button>
        </>
      )}
    </Section>
  );
}

function WatchlistCard({ symbol }: { symbol: string }) {
  const q = useAsync<Quote>(() => api.quote(symbol), [symbol]);
  if (q.loading) return <Skeleton className="h-28" />;
  if (q.error || !q.data)
    return (
      <div className="card text-sm text-slate-400">
        <div className="tnum text-slate-200">{symbol}</div>
        Could not load quote.
      </div>
    );
  return <QuoteCard quote={q.data} />;
}
