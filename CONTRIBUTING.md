# Contributing to InvestMate AI

Thanks for your interest in improving InvestMate AI. This guide covers how to
set up the project, the conventions it follows, and how to propose changes.

InvestMate AI is an educational investment-research companion for NSE-listed
stocks. It is not investment advice, and that framing is a hard constraint:
contributions must not add guaranteed buy/sell predictions, profit promises, or
anything that presents sample data as live market data.

## Ground rules

- Be respectful and constructive. Assume good intent.
- Keep changes focused. One logical change per pull request.
- Never commit secrets, credentials, or `.env` files. The app needs no secret
  to run; if you add a third-party provider, use environment variables and
  update `.env.example`.
- Preserve the data-honesty guarantees: every market-data response must carry
  its `source`, `asOf`, and `isSample` provenance, and the UI must label
  demonstration data wherever it appears.

## Project layout

```
backend/     Python AWS Lambda: agent orchestrator, MCP adapter, API, tests
frontend/    React + TypeScript + Vite + Tailwind + Recharts SPA
docs/        Deployment guide, architecture diagrams, article, screenshots
.kiro/       Spec (requirements/design/tasks) and steering rules
```

## Local setup

### Backend (Python 3.13)
```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m pytest -q               # all tests must pass
python local_server.py            # http://localhost:8000  (prefix /api/v1)
```
Local defaults use in-memory storage and labelled sample data, so no AWS
credentials are needed to run or test the backend offline.

### Frontend (Node 18+)
```bash
cd frontend
npm install
npm test                          # vitest
npm run dev                       # http://localhost:5173
```

## Making a change

1. Fork the repo and create a branch: `git checkout -b feat/short-description`
   or `fix/short-description`.
2. Make your change with tests. New features and bug fixes should add or update
   tests under `backend/tests/` or alongside the frontend code.
3. Run the full checks locally before pushing:
   - Backend: `cd backend && python -m pytest -q`
   - Frontend: `cd frontend && npm test && npm run build`
4. Commit with a clear message (see below), push your branch, and open a pull
   request against `main`.

## Coding conventions

### Backend
- Standard library and `boto3` first; keep Lambda dependencies minimal. The
  deployed function bundles only what `requirements-lambda.txt` lists.
- The agent must never fabricate tool results. If Amazon Bedrock fails, raise
  `BedrockUnavailable` and return a structured error rather than an invented
  answer.
- Validate all request input in `validation.py`; return the consistent JSON
  envelope (`{ok, data, meta}` / `{ok, error}`) and never leak stack traces.
- Keep secrets and internal config out of the `/health` and `/integrations/nse`
  responses.

### Frontend
- Follow the rules in `.kiro/steering/design-taste.md`. In particular: no
  em-dashes in user-facing text (use a hyphen, comma, or period), numbers render
  in the mono (`tnum`) face, one accent color, and every data surface needs
  loading, empty, and error states.
- Keep demonstration-data labels and freshness timestamps visible.
- Respect `prefers-reduced-motion` and keep interactive elements keyboard
  accessible with visible focus.

## Commit messages

Use short, imperative, prefixed messages, for example:
- `feat: add 52-week high/low to the quote card`
- `fix: preserve the question when the research call times out`
- `docs: expand the deployment teardown steps`
- `test: cover insufficient-data volatility guard`

## Reporting issues

Open a GitHub issue with: what you expected, what happened, steps to reproduce,
and your environment (OS, Node and Python versions). For UI issues, a screenshot
helps. For data-correctness issues, include the symbol, period, and the
`source` / `asOf` shown in the response.

## License

By contributing, you agree that your contributions are licensed under the MIT
License in `LICENSE`.
