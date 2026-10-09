import type {
  ApiResponse,
  History,
  IndexSnapshot,
  IntegrationStatus,
  PortfolioResult,
  Quote,
  ResearchResult,
  SearchResult,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const PREFIX = `${BASE}/api/v1`;

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function clientId(): string {
  let id = localStorage.getItem("investmate.clientId");
  if (!id) {
    id = (crypto.randomUUID?.() || `c-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem("investmate.clientId", id);
  }
  return id;
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; meta?: unknown }> {
  let res: Response;
  try {
    res = await fetch(`${PREFIX}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId(),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiError("NETWORK", "Could not reach the server. Check your connection and retry.");
  }
  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError("BAD_RESPONSE", `Unexpected server response (HTTP ${res.status}).`);
  }
  if (!body.ok) {
    throw new ApiError(body.error.code, body.error.message);
  }
  return { data: body.data, meta: (body as { meta?: unknown }).meta };
}

export const api = {
  clientId,
  health: () => request<{ status: string; model: string; region: string }>("/health"),
  integrations: () => request<IntegrationStatus>("/integrations/nse"),
  indices: () => request<IndexSnapshot[]>("/indices"),
  search: (q: string) => request<SearchResult[]>(`/stocks/search?q=${encodeURIComponent(q)}`),
  quote: (symbol: string) => request<Quote>(`/stocks/${encodeURIComponent(symbol)}`),
  history: (symbol: string, period: string) =>
    request<History>(`/stocks/${encodeURIComponent(symbol)}/history?period=${period}`),
  research: (payload: {
    question: string;
    symbol?: string;
    period?: string;
    beginnerMode: boolean;
  }) => request<ResearchResult>("/research", { method: "POST", body: JSON.stringify(payload) }),
  getWatchlist: () => request<{ symbols: string[] }>(`/watchlist?clientId=${clientId()}`),
  putWatchlist: (symbols: string[]) =>
    request<{ symbols: string[] }>("/watchlist", {
      method: "PUT",
      body: JSON.stringify({ clientId: clientId(), symbols }),
    }),
  portfolioRisk: (holdings: Array<{ symbol: string; quantity: number; price?: number }>) =>
    request<PortfolioResult>("/portfolio/risk", {
      method: "POST",
      body: JSON.stringify({ holdings }),
    }),
};

export { PREFIX as API_PREFIX };
