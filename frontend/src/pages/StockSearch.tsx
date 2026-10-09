import { useState } from "react";
import { api, ApiError } from "../api";
import type { Quote, SearchResult } from "../types";
import { QuoteCard } from "../components/QuoteCard";
import { EmptyState, ErrorState, Section, Skeleton } from "../components/ui";

export function StockSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.search(query);
      setResults(data);
      // fetch quotes for the matches in parallel
      const entries = await Promise.all(
        data.slice(0, 9).map(async (r) => {
          try {
            const res = await api.quote(r.symbol);
            return [r.symbol, res.data] as const;
          } catch {
            return null;
          }
        })
      );
      const map: Record<string, Quote> = {};
      for (const e2 of entries) if (e2) map[e2[0]] = e2[1];
      setQuotes(map);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Stock search">
        <form onSubmit={doSearch} className="flex gap-2" role="search">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by symbol or company name (e.g. TCS, bank, reliance)"
            aria-label="Search stocks"
          />
          <button className="btn-primary" disabled={loading || !q.trim()}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </Section>

      <Section title="Results">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => doSearch()} />
        ) : results == null ? (
          <EmptyState title="Search for a stock" hint="Type a symbol or company name to begin." />
        ) : results.length === 0 ? (
          <EmptyState title="No matches" hint="Try a different symbol or name." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) =>
              quotes[r.symbol] ? (
                <QuoteCard key={r.symbol} quote={quotes[r.symbol]} />
              ) : (
                <div key={r.symbol} className="card">
                  <div className="font-semibold text-slate-100 tnum">{r.symbol}</div>
                  <div className="text-xs text-slate-400">{r.name}</div>
                  <div className="text-[11px] text-slate-500 mt-2">{r.sector}</div>
                </div>
              )
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
