# InvestMate AI — Requirements

**Tagline:** Understand the market before making your next move.

InvestMate AI is an AI-powered investment research companion for Indian retail
investors. It helps users understand NSE-listed stocks, market movements,
historical market data, and basic portfolio risk through clear,
evidence-grounded explanations.

This document uses testable acceptance criteria in EARS-style
("WHEN ... THE SYSTEM SHALL ...") form.

---

## Context & verified constraints (discovery phase)

These facts were verified during discovery and shape every requirement below.

- **AWS**: account `466742534146`, region `us-east-1`, admin credentials present.
- **Bedrock**: `amazon.nova-lite-v1:0` invocation confirmed working in `us-east-1`.
- **NSE MCP endpoints** (official, per https://www.nseindia.com/nse-mcp):
  - `cm-market` → `https://mcp.nseindia.in/cmmkt/mcp`
  - `nse-bhavcopy` → `https://mcp.nseindia.in/bhavcopy/cm/mcp`
  - Transport: `streamable-http`, Authentication: No Auth.
- **VERIFIED BLOCKER**: Both endpoints sit behind **Akamai Bot Manager**.
  Server-to-server requests (tested via curl, httpx HTTP/1.1 and HTTP/2, and the
  official MCP Python SDK — 6+ attempts) return `504 Gateway Time-out` with an
  Akamai JavaScript challenge. The documented clients are Claude Desktop,
  Claude.ai connectors, and ChatGPT — all browser/desktop apps that execute the
  JS challenge. A headless Lambda/backend cannot complete the challenge, so it
  cannot reach these endpoints directly.
- **NSE data license**: NSE's disclaimer states the data is for
  educational/informational purposes only, is **not** for commercial use, and
  grants **no** license to train or fine-tune AI systems.

### Consequence for the design
The system is built to speak the real MCP `streamable-http` protocol and will
use live NSE tools automatically **if/when** an endpoint becomes reachable from
the runtime (configurable base URL supports a browser-session proxy). Until
then it falls back to a **clearly labelled, deterministic sample-data provider**.
The system must **never** present sample data as live NSE data.

---

## Requirement 1 — Research conversation (signature workflow)

**User story:** As a retail investor, I want to ask a natural-language question
about an NSE stock and receive an evidence-grounded explanation, so that I can
understand what the data shows without reading complex reports.

### Acceptance criteria
1. WHEN a user submits a research question with a resolvable NSE symbol, THE
   SYSTEM SHALL (a) select the appropriate data tool(s), (b) retrieve data via
   the data provider, (c) return an explanation grounded only in the retrieved
   values, and (d) include the data source label, timestamp, and requested
   period.
2. WHEN the agent references a numeric value in its explanation, THE SYSTEM
   SHALL only use values present in the retrieved tool results (no fabricated
   numbers).
3. WHEN a tool call did not occur, THE SYSTEM SHALL NOT claim that a source was
   queried.
4. WHEN sufficient data is available, THE SYSTEM SHALL compute simple derived
   metrics (period return %, high/low, average volume) and label each.
5. WHEN the response is produced, THE SYSTEM SHALL include at least one useful
   suggested follow-up question.
6. WHEN required evidence is missing, THE SYSTEM SHALL state the uncertainty and
   not invent an explanation for a price movement.

## Requirement 2 — Data provider abstraction & honesty

**User story:** As a user, I want to always know whether I'm looking at real NSE
data or demonstration data, so that I can trust the app.

### Acceptance criteria
1. WHEN the backend returns any market data, THE SYSTEM SHALL tag it with
   `source` (e.g. `nse-mcp:cm-market`, `nse-mcp:nse-bhavcopy`, or
   `sample-data`), an `asOf` timestamp, and a boolean `isSample`.
2. WHEN `isSample` is true, THE UI SHALL display a visible "Demonstration data"
   label on every surface showing that data.
3. WHEN a live NSE request fails, THE SYSTEM SHALL NOT silently substitute stale
   or sample data into a response that is presented as live.
4. WHEN the MCP endpoint is configured and reachable, THE SYSTEM SHALL prefer
   live NSE tool results over sample data.
5. THE SYSTEM SHALL keep MCP operations server-side and SHALL NOT expose MCP
   URLs, internal config, or secrets to the browser.

## Requirement 3 — Beginner Mode ("Explain It Like I'm New to Investing")

**User story:** As a beginner, I want explanations in plain language structured
so I can learn, so that investing concepts are approachable.

### Acceptance criteria
1. WHEN Beginner Mode is enabled, THE SYSTEM SHALL structure every explanation
   into three sections: **What the data shows**, **What it might mean**, **What
   to research next**.
2. WHEN Beginner Mode is enabled, THE SYSTEM SHALL explain financial terms in
   plain English and avoid alarming language, urgency, or profit promises.
3. THE SYSTEM SHALL NOT provide guaranteed buy/sell predictions in any mode.
4. WHEN evidence cannot explain a movement, THE SYSTEM SHALL say so explicitly
   and separate confirmed facts from possible interpretations.

## Requirement 4 — Dashboard & market data UI

### Acceptance criteria
1. THE SYSTEM SHALL present a dashboard with: market index overview, stock
   search, quote cards, a historical price chart, a watchlist, and the AI chat
   panel.
2. WHEN historical data is available for a symbol/period, THE SYSTEM SHALL render
   an OHLC/close line chart with visible date ranges.
3. WHEN a metric or feature is unavailable, THE SYSTEM SHALL display an honest
   empty/unavailable state rather than fabricated values.
4. THE SYSTEM SHALL show a data-freshness indicator reflecting the `asOf`
   timestamp and source.

## Requirement 5 — Watchlist & preferences

### Acceptance criteria
1. WHEN a user adds/removes a symbol, THE SYSTEM SHALL persist the change
   (DynamoDB) keyed by an anonymous client id and reflect it on reload.
2. WHEN the watchlist is empty, THE SYSTEM SHALL show a helpful empty state.

## Requirement 6 — Portfolio Risk Explorer

### Acceptance criteria
1. WHEN a user enters holdings (symbol + quantity + optional price), THE SYSTEM
   SHALL compute allocation %, largest-holding concentration, and (when enough
   price history exists) historical volatility, each clearly labelled.
2. WHEN there is insufficient price history, THE SYSTEM SHALL NOT produce a
   volatility figure and SHALL explain why.
3. THE SYSTEM SHALL state limitations (volatility is not a prediction;
   diversification does not remove risk) and SHALL NOT request brokerage
   credentials or execute trades.

## Requirement 7 — API & robustness

### Acceptance criteria
1. THE SYSTEM SHALL expose versioned endpoints: `POST /api/v1/research`,
   `GET /api/v1/stocks/{symbol}`, `GET /api/v1/stocks/{symbol}/history`,
   `GET /api/v1/health`, `GET /api/v1/integrations/nse`, and watchlist CRUD.
2. WHEN a request has invalid parameters, THE SYSTEM SHALL return `400` with a
   consistent JSON error shape and no stack trace.
3. WHEN an upstream (Bedrock or MCP) fails, THE SYSTEM SHALL return a structured
   error and preserve the user's question context.
4. THE `GET /api/v1/health` and `GET /api/v1/integrations/nse` responses SHALL
   NOT contain secrets, credentials, or internal exception traces.
5. THE SYSTEM SHALL apply request validation and API Gateway throttling.

## Requirement 8 — AWS deployment

### Acceptance criteria
1. THE SYSTEM SHALL be deployable via infrastructure-as-code (AWS SAM).
2. THE SYSTEM SHALL use least-privilege IAM (Bedrock invoke on the chosen model;
   DynamoDB access scoped to the app table) and emit CloudWatch logs.
3. WHEN deployed, a real end-to-end research request SHALL succeed against the
   live API, and the result SHALL be verified before claiming success.

## Requirement 9 — Testing & evidence

### Acceptance criteria
1. THE SYSTEM SHALL include automated tests covering: MCP discovery success,
   tool parameter validation, invalid-symbol handling, MCP timeout/failure
   handling, Bedrock-failure (no invented answer), verified-vs-interpretation
   separation, historical date retention, insufficient-data risk guard, sample
   labelling, UI question-preservation on failure, API input validation,
   health-endpoint secret hygiene, and a full E2E happy path (mocked deps).
2. THE SYSTEM SHALL document which tests passed, failed, or were blocked.

## Out of scope (weekend)
- Derivatives/options analytics, real-time tick/order-book data, brokerage
  integration, user authentication beyond anonymous client id, and any
  commercial use of NSE data.
