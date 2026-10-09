import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

type Theme = "dark" | "light";

interface AppState {
  beginnerMode: boolean;
  setBeginnerMode: (v: boolean) => void;
  theme: Theme;
  toggleTheme: () => void;
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  inWatchlist: (symbol: string) => boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [beginnerMode, setBeginnerModeState] = useState<boolean>(
    () => localStorage.getItem("investmate.beginnerMode") !== "false"
  );
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("investmate.theme") as Theme) || "dark"
  );
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("investmate.theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    api
      .getWatchlist()
      .then((r) => setWatchlist(r.data.symbols))
      .catch(() => void 0);
  }, []);

  const setBeginnerMode = useCallback((v: boolean) => {
    setBeginnerModeState(v);
    localStorage.setItem("investmate.beginnerMode", String(v));
  }, []);

  const addToWatchlist = useCallback(
    (symbol: string) => {
      const s = symbol.toUpperCase();
      setWatchlist((prev) => {
        if (prev.includes(s)) return prev;
        const next = [...prev, s];
        api.putWatchlist(next).catch(() => void 0);
        return next;
      });
    },
    []
  );

  const removeFromWatchlist = useCallback((symbol: string) => {
    const s = symbol.toUpperCase();
    setWatchlist((prev) => {
      const next = prev.filter((x) => x !== s);
      api.putWatchlist(next).catch(() => void 0);
      return next;
    });
  }, []);

  const inWatchlist = useCallback((symbol: string) => watchlist.includes(symbol.toUpperCase()), [watchlist]);

  return (
    <Ctx.Provider
      value={{ beginnerMode, setBeginnerMode, theme, toggleTheme, watchlist, addToWatchlist, removeFromWatchlist, inWatchlist }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
