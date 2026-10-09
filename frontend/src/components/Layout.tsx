import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useApp } from "../store";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/research", label: "AI Research" },
  { to: "/search", label: "Stock Search" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/history", label: "Historical Data" },
  { to: "/portfolio", label: "Portfolio Risk" },
  { to: "/settings", label: "Settings & Health" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { beginnerMode, setBeginnerMode } = useApp();

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 bg-navy-950/90 backdrop-blur border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent/20 border border-accent/40 grid place-items-center text-accent font-bold">
              IM
            </div>
            <div>
              <div className="font-semibold text-slate-100 leading-tight">InvestMate AI</div>
              <div className="text-[11px] text-slate-500 leading-tight">
                Understand the market before making your next move.
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <BeginnerToggle enabled={beginnerMode} onChange={setBeginnerMode} />
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-accent text-slate-100"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">{children}</main>

      <footer className="border-t border-navy-800 text-xs text-slate-500 py-3 px-4 text-center">
        Educational use only. Not investment advice. Market data shown may be
        demonstration data and is clearly labelled when so.
      </footer>
    </div>
  );
}

function BeginnerToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none" title="Explain It Like I'm New to Investing">
      <span className="text-xs text-slate-300 hidden sm:inline">Explain it like I'm new</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle Beginner Mode"
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          enabled ? "bg-accent" : "bg-navy-600"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
