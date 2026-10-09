import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "../store";
import { SearchBox } from "./SearchBox";
import { BackButton } from "./BackButton";

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
  const navigate = useNavigate();

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 bg-navy-950/90 backdrop-blur border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          {/* Logo (left) */}
          <button
            className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            onClick={() => navigate("/")}
            aria-label="InvestMate AI home"
          >
            <div className="h-8 w-8 rounded-lg bg-accent/20 border border-accent/40 grid place-items-center text-accent font-bold">
              IM
            </div>
            <div className="text-left hidden sm:block">
              <div className="font-semibold text-slate-100 leading-tight">InvestMate AI</div>
              <div className="text-[11px] text-slate-500 leading-tight">
                Understand the market before making your next move.
              </div>
            </div>
          </button>

          {/* Global search (center) */}
          <div className="flex-1 max-w-md hidden md:block">
            <SearchBox
              compact
              placeholder="Search any NSE stock..."
              onSelect={(sym) => navigate(`/history?symbol=${encodeURIComponent(sym)}`)}
            />
          </div>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        <BackButton />
        {children}
      </main>

      <footer className="border-t border-navy-800 text-xs text-slate-500 py-3 px-4 text-center">
        Educational use only. Not investment advice. Market data shown may be
        demonstration data and is clearly labelled when so.
      </footer>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  const dark = theme === "dark";
  return (
    <button
      className="btn-ghost px-2"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      <span aria-hidden="true">{dark ? "\u2600" : "\u263E"}</span>
    </button>
  );
}

function UserMenu() {
  const { beginnerMode, setBeginnerMode, theme, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="h-8 w-8 rounded-full bg-accent/25 border border-accent/40 grid place-items-center text-accent text-sm font-semibold">
          AI
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-xs font-medium text-slate-200">Aarav Investor</span>
          <span className="text-[10px] text-slate-500">Guest (demo)</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-xl bg-navy-900 border border-navy-700 shadow-lg p-2 text-sm"
        >
          <div className="px-2 py-2 border-b border-navy-700 mb-1">
            <div className="font-medium text-slate-100">Aarav Investor</div>
            <div className="text-xs text-slate-500">demo account, no sign-in required</div>
          </div>
          <label className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-navy-800 cursor-pointer">
            <span className="text-slate-200">Beginner Mode</span>
            <input
              type="checkbox"
              checked={beginnerMode}
              onChange={(e) => setBeginnerMode(e.target.checked)}
              className="accent-[color:var(--accent,#4f8cff)]"
              aria-label="Toggle Beginner Mode"
            />
          </label>
          <button
            role="menuitem"
            className="w-full text-left px-2 py-2 rounded-lg hover:bg-navy-800 text-slate-200"
            onClick={toggleTheme}
          >
            Switch to {theme === "dark" ? "light" : "dark"} theme
          </button>
          <div className="px-2 py-2 text-[11px] text-slate-500 border-t border-navy-700 mt-1">
            Profile is a demo placeholder. No personal data is stored.
          </div>
        </div>
      )}
    </div>
  );
}
