import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

interface AppState {
  beginnerMode: boolean;
  setBeginnerMode: (v: boolean) => void;
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
  const [watchlist, setWatchlist] = useState<string[]>([]);

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
      value={{ beginnerMode, setBeginnerMode, watchlist, addToWatchlist, removeFromWatchlist, inWatchlist }}
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
