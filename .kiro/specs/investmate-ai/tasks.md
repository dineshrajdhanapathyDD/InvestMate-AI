# InvestMate AI — Implementation Plan

- [x] 1. Discovery: verify AWS/Bedrock access and probe NSE MCP transport &
      capabilities. (Akamai blocker confirmed; Nova Lite confirmed.)
- [x] 2. Author spec (requirements, design, tasks).
- [ ] 3. Scaffold monorepo: `backend/`, `frontend/`, `infra/`, `docs/`.
- [ ] 4. Backend data layer
  - [ ] 4.1 `ProviderResult` + `MarketDataProvider` interface.
  - [ ] 4.2 `SampleDataProvider` (deterministic, seeded, labelled).
  - [ ] 4.3 `NseMcpProvider` (official MCP SDK, streamable-http, timeouts/retries).
  - [ ] 4.4 `ResilientProvider` (live-first, labelled fallback).
- [ ] 5. Backend agent
  - [ ] 5.1 Bedrock Converse tool-use loop + system prompt + fabrication guard.
  - [ ] 5.2 Beginner Mode 3-section formatting.
  - [ ] 5.3 Derived metrics (return %, hi/lo, avg volume) + volatility guard.
- [ ] 6. Backend API
  - [ ] 6.1 Router + request validation + consistent JSON envelope.
  - [ ] 6.2 Endpoints: research, stocks, history, search, indices, health,
        integrations/nse, watchlist, portfolio/risk.
  - [ ] 6.3 DynamoDB watchlist/prefs persistence.
- [ ] 7. Infra (SAM): API Gateway + Lambda + DynamoDB + IAM least privilege +
      throttling + outputs.
- [ ] 8. Frontend
  - [ ] 8.1 Vite+TS+Tailwind scaffold, routing, theme, API client.
  - [ ] 8.2 Dashboard, chat, search, watchlist, history chart, portfolio, settings.
  - [ ] 8.3 Beginner toggle, sample badges, freshness chip, skeletons, errors.
- [ ] 9. Tests (backend pytest + frontend vitest) — run and record results.
- [ ] 10. Deploy via SAM; verify live E2E; build+host frontend.
- [ ] 11. Docs: deployment README, teardown, Builder Center article draft.
