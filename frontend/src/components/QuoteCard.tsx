import type { Quote } from "../types";
import { inr, moveClass, num, pct } from "../format";
import { useApp } from "../store";

export function QuoteCard({ quote, onOpen }: { quote: Quote; onOpen?: (symbol: string) => void }) {
  const { inWatchlist, addToWatchlist, removeFromWatchlist } = useApp();
  const watched = inWatchlist(quote.symbol);

  return (
    <div className="card hover:border-navy-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          onClick={() => onOpen?.(quote.symbol)}
          title={`Open ${quote.symbol}`}
        >
          <div className="font-semibold text-slate-100">{quote.symbol}</div>
          <div className="text-xs text-slate-400 line-clamp-1">{quote.name}</div>
        </button>
        <button
          className="text-xs text-slate-400 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1"
          aria-pressed={watched}
          aria-label={watched ? `Remove ${quote.symbol} from watchlist` : `Add ${quote.symbol} to watchlist`}
          onClick={() => (watched ? removeFromWatchlist(quote.symbol) : addToWatchlist(quote.symbol))}
        >
          {watched ? "★" : "☆"}
        </button>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div className="text-xl font-semibold text-slate-100">₹{inr(quote.lastPrice)}</div>
        <div className={`text-sm font-medium ${moveClass(quote.change)}`}>
          {quote.change > 0 ? "▲" : quote.change < 0 ? "▼" : "■"} {pct(quote.changePct)}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-slate-400">
        <div>H ₹{inr(quote.dayHigh)}</div>
        <div>L ₹{inr(quote.dayLow)}</div>
        <div className="text-right">Vol {num(quote.volume)}</div>
      </div>
    </div>
  );
}
