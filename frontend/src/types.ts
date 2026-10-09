export interface Meta {
  source: string;
  asOf: string;
  isSample: boolean;
  note?: string | null;
}

export interface ApiOk<T> {
  ok: true;
  data: T;
  meta?: Meta;
}

export interface ApiErr {
  ok: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export interface Quote {
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryMetrics {
  observations: number;
  periodReturnPct: number | null;
  high: number | null;
  low: number | null;
  avgVolume: number | null;
  annualizedVolatilityPct: number | null;
  volatilitySufficient: boolean;
  volatilityNote: string | null;
}

export interface History {
  symbol: string;
  period: string;
  candles: Candle[];
  metrics?: HistoryMetrics;
}

export interface IndexSnapshot {
  name: string;
  value: number;
  change: number;
  changePct: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  sector: string;
}

export interface ResearchSource {
  source: string;
  asOf: string;
  isSample: boolean;
  note?: string | null;
}

export interface ResearchResult {
  answer: string;
  evidence: Array<{ tool: string; args: Record<string, unknown>; meta: Meta }>;
  sources: ResearchSource[];
  usedTools: string[];
  isSample: boolean;
  beginnerMode: boolean;
}

export interface IntegrationStatus {
  enabled: boolean;
  transport: string;
  endpoints: Record<string, string>;
  mode: string;
  probe: Record<string, unknown>;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  price: number;
  value: number;
  allocationPct: number;
  annualizedVolatilityPct: number | null;
}

export interface PortfolioResult {
  totalValue: number;
  holdings: PortfolioHolding[];
  largestHolding: { symbol: string; allocationPct: number } | null;
  sectorAllocation: Array<{ sector: string; allocationPct: number }>;
  limitations: string[];
  meta: { source: string; isSample: boolean };
}
