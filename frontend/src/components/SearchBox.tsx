import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { SearchResult } from "../types";

/**
 * Debounced type-ahead stock search. Shows symbol + company name suggestions
 * and supports keyboard navigation (arrow keys + Enter + Escape).
 */
export function SearchBox({
  onSelect,
  placeholder = "Search symbol or company...",
  autoFocus = false,
  compact = false,
}: {
  onSelect: (symbol: string, result?: SearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Debounced fetch as the user types.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.search(query);
        setResults(data);
        setOpen(true);
        setActive(data.length ? 0 : -1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(r: SearchResult) {
    onSelect(r.symbol, r);
    setQ("");
    setResults([]);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !results.length) {
      if (e.key === "Enter" && q.trim()) {
        onSelect(q.trim().toUpperCase());
        setQ("");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className={`input ${compact ? "py-1.5 text-sm" : ""}`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="search-suggestions"
        aria-label="Search stocks"
      />
      {loading && q.trim() && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">...</span>
      )}
      {open && results.length > 0 && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-80 overflow-auto rounded-lg bg-navy-800 border border-navy-700 shadow-lg"
        >
          {results.map((r, i) => (
            <li
              key={r.symbol}
              role="option"
              aria-selected={i === active}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer ${
                i === active ? "bg-navy-700" : "hover:bg-navy-700"
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
            >
              <span className="flex flex-col">
                <span className="tnum text-sm text-slate-100">{r.symbol}</span>
                <span className="text-xs text-slate-400 line-clamp-1">{r.name}</span>
              </span>
              <span className="text-[11px] text-slate-500">{r.sector}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && q.trim() && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg bg-navy-800 border border-navy-700 px-3 py-2 text-sm text-slate-400">
          No matches for "{q}"
        </div>
      )}
    </div>
  );
}
