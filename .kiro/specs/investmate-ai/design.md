# InvestMate AI — Technical Design

## 1. Architecture overview

```
                        ┌──────────────────────────────────────────────┐
   Browser (React SPA)  │  S3 + CloudFront (static hosting)             │
   ───────────────────▶ │  Vite build: dashboard, chat, charts, etc.   │
                        └───────────────┬──────────────────────────────┘
                                        │ HTTPS (CORS)
                                        ▼
                        ┌──────────────────────────────────────────────┐
   Amazon API Gateway   │  REST API /api/v1/*  (throttling + validation)│
                        └───────────────┬──────────────────────────────┘
                                        │ Lambda proxy
                                        ▼
                        ┌──────────────────────────────────────────────┐
   AWS Lambda (Python)  │  app router → handlers                        │
                        │   ├─ agent orchestrator (Bedrock tool-use)    │
                        │   ├─ data provider (MCP adapter | sample)     │
                        │   └─ watchlist/portfolio handlers             │
                        └──────┬───────────────────────┬────────────────┘
                               │                       │
                 ┌─────────────▼───────┐   ┌───────────▼─────────────────┐
                 │ Amazon Bedrock      │   │ NSE MCP (streamable-http)   │
                 │ amazon.nova-lite    │   │ cm-market / nse-bhavcopy    │
                 │ (Converse tool-use) │   │ ⚠ Akamai-blocked → fallback │
                 └─────────────────────┘   └─────────────────────────────┘
                               │
                 ┌─────────────▼───────┐
                 │ Amazon DynamoDB     │  watchlist + preferences
                 └─────────────────────┘
```

CloudWatch logs/metrics across Lambda + API Gateway.

## 2. The NSE MCP blocker and the data-provider strategy

### What was verified
Both official NSE MCP endpoints are fronted by **Akamai Bot Manager**.
Server-to-server MCP handshakes (`initialize`) consistently return
`504 Gateway Time-out` plus an Akamai JS challenge. This was reproduced with
curl, httpx (HTTP/1.1 and HTTP/2), and the official `mcp` Python SDK's
`streamablehttp_client`. The TLS connection to Akamai succeeds; the origin never
responds to a non-browser client. The documented clients (Claude Desktop,
Claude.ai, ChatGPT) are browsers/desktop apps that solve the challenge.

### Design response: `MarketDataProvider` interface
A single interface, two implementations, chosen at runtime:

```python
class MarketDataProvider(Protocol):
    def search_symbol(self, query) -> ProviderResult: ...
    def get_quote(self, symbol) -> ProviderResult: ...
    def get_history(self, symbol, start, end) -> ProviderResult: ...
    def get_index_overview(self) -> ProviderResult: ...

@dataclass
class ProviderResult:
    data: Any
    source: str          # "nse-mcp:cm-market" | "sample-data" | ...
    as_of: str           # ISO-8601 timestamp of the data
    is_sample: bool
    note: str | None     # e.g. "Live NSE endpoint unreachable (Akamai); using sample data"
```

1. **`NseMcpProvider`** — a real MCP client over `streamable-http` using the
   official `mcp` SDK. Base URLs come from env vars. It applies a connect
   timeout, a short read timeout, bounded retries, response normalization, and
   clean connection teardown. If the handshake/tool-call fails (the Akamai
   case), it raises `ProviderUnavailable`.
2. **`SampleDataProvider`** — deterministic, offline, seeded per symbol. Returns
   realistic OHLCV series and quotes. Every result has `is_sample=True` and a
   `source="sample-data"`. Numbers are reproducible (seeded by symbol) so tests
   and charts are stable.
3. **`ResilientProvider`** — tries `NseMcpProvider` first when
   `NSE_MCP_ENABLED=true`, catches `ProviderUnavailable`, and falls back to
   `SampleDataProvider` **with `is_sample=True` and a `note` explaining the
   fallback**. It never masks sample data as live.

`GET /api/v1/integrations/nse` reports, in sanitized form: configured endpoints
(host only, no secrets), `transport: streamable-http`, last probe result, and
the human-readable reason (Akamai challenge) when unreachable.

### Reachability note
The provider base URL is configurable. If the user later runs a browser-session
proxy (e.g. a service that solves the Akamai challenge and forwards MCP calls),
pointing `NSE_MCP_CM_URL` / `NSE_MCP_BHAV_URL` at that proxy makes the live path
work with no code change.

## 3. Agent orchestrator (Bedrock tool-use)

- **Region**: `ap-south-1` (Mumbai) by default, for low latency to Indian users
  and in-region data. Configurable via `BEDROCK_REGION`.
- **Model**: `apac.amazon.nova-lite-v1:0` (default, configurable via
  `BEDROCK_MODEL_ID`). Note: in `ap-south-1` Nova is only invocable through a
  cross-region **inference profile** (the `apac.*` id); the raw
  `amazon.nova-lite-v1:0` id works on-demand only in `us-east-1`. Both paths were
  verified by live Converse calls during development.
- **API**: Bedrock Runtime **Converse** API with a `toolConfig` declaring tools
  the model may request: `search_symbol`, `get_quote`, `get_history`,
  `get_index_overview`.
- **Controlled loop** (max 3 tool rounds):
  1. Send system prompt + user question + `toolConfig`.
  2. If `stopReason == "tool_use"`, the backend executes the requested tool via
     the `MarketDataProvider` (the model never fabricates results), appends a
     `toolResult` block, and continues.
  3. When the model returns final text, the backend attaches the real
     `source`/`asOf`/`isSample` metadata collected from the executed tools.
- **System prompt** enforces: ground every claim in tool results; never invent
  numbers; separate confirmed facts from interpretation; no buy/sell guarantees;
  in Beginner Mode use the three-section structure.
- **Fabrication guard**: the response envelope includes `evidence` (the actual
  tool results used). A post-check verifies the agent only cited symbols/periods
  that were actually fetched; if Bedrock fails, the handler returns a structured
  error — it never returns a model answer with no evidence as if grounded.

## 4. API surface (`/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/research` | `{question, symbol?, period?, beginnerMode}` → grounded answer + evidence + sources |
| GET | `/stocks/{symbol}` | quote card data |
| GET | `/stocks/{symbol}/history?period=` | OHLCV series |
| GET | `/stocks/search?q=` | symbol search |
| GET | `/indices` | NIFTY/SENSEX overview |
| GET | `/health` | app health (no secrets) |
| GET | `/integrations/nse` | sanitized MCP status |
| GET/PUT | `/watchlist` | read/replace watchlist for a client id |
| POST | `/portfolio/risk` | holdings → allocation/concentration/volatility |

Consistent envelope:
```json
{ "ok": true, "data": {...}, "meta": { "source": "...", "asOf": "...", "isSample": true } }
{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "..." } }
```

Validation: symbol regex `^[A-Z0-9&\-]{1,20}$`, period enum
(`1W,1M,3M,6M,1Y,5Y`), question length ≤ 1000. API Gateway stage throttling
(e.g. 10 rps / burst 20).

## 5. Frontend

- React 18 + TypeScript + Vite + Tailwind + Recharts + React Router.
- Navy/neutral palette; restrained green/red for moves; accessible contrast.
- Pages: Dashboard, Research Chat, Stock Search, Watchlist, Historical Data,
  Portfolio Risk, Settings/Connection Health.
- Cross-cutting: loading skeletons, empty states, error+retry, Beginner Mode
  toggle (persisted), visible "Demonstration data" badges, data-freshness chip,
  conversation persistence across recoverable failures (question retained).
- A small typed API client; config via `VITE_API_BASE_URL`.

## 6. Data model (DynamoDB)

Single table `investmate` (on-demand):
- `pk = CLIENT#<id>`, `sk = WATCHLIST` → `{ symbols: [...] }`
- `pk = CLIENT#<id>`, `sk = PREFS` → `{ beginnerMode: bool }`

Anonymous `clientId` generated in the browser (UUID in localStorage); no PII.

## 7. Security

- IAM least privilege: `bedrock:InvokeModel` on the one model ARN;
  `dynamodb:{GetItem,PutItem,Query}` on the one table.
- No secrets in code or client. (No third-party API keys are required; Secrets
  Manager is wired only if such a secret is later introduced.)
- CORS limited to the CloudFront origin (and `localhost` for dev).
- Health/integration endpoints return sanitized data only.
- All external data (MCP, model output) treated as untrusted; validated and
  normalized before use.

## 8. Error handling

| Failure | Behavior |
|---|---|
| MCP unreachable (Akamai) | fall back to sample provider, `isSample=true`, `note` set; `integrations/nse` shows reason |
| Bedrock throttling/error | `503` structured error; question preserved client-side; retry button |
| Invalid input | `400` structured error |
| Insufficient history for volatility | omit metric + explanation |

## 9. Testing strategy

- Backend: `pytest`, external calls mocked. Covers the 13 required cases.
- Frontend: `vitest` + Testing Library for the question-preservation and
  sample-label behaviors.
- Integration (opt-in): live Bedrock call behind an env flag; live MCP probe
  documented as blocked.

## 10. Cost

Serverless, on-demand. Nova Lite is low cost; expected weekend spend is a few
cents to low single-digit dollars. A budget alert is recommended but creation is
gated on explicit confirmation.
