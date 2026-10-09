"""Framework-agnostic request router.

Takes a normalized request (method, path, query, json body, headers) and returns
(status_code, body_dict). Shared by the Lambda handler and the local dev server
so behavior is identical in both.
"""
from __future__ import annotations

import logging

from . import catalog, metrics, portfolio as portfolio_mod, validation
from .agent import BedrockUnavailable, ResearchAgent
from .config import config
from .providers.resilient import ResilientProvider
from .store import Store
from .validation import ValidationError

log = logging.getLogger("investmate.router")

API_PREFIX = "/api/v1"


def ok(data, meta=None, status=200):
    body = {"ok": True, "data": data}
    if meta is not None:
        body["meta"] = meta
    return status, body


def err(code, message, status):
    return status, {"ok": False, "error": {"code": code, "message": message}}


class Router:
    def __init__(self, provider: ResilientProvider | None = None, store: Store | None = None):
        self.provider = provider or ResilientProvider()
        self.store = store or Store()

    def handle(self, method: str, path: str, query: dict, body: dict, headers: dict):
        method = method.upper()
        # strip stage prefixes / trailing slash
        if path.startswith(API_PREFIX):
            route = path[len(API_PREFIX):] or "/"
        else:
            route = path
        route = route.rstrip("/") or "/"
        query = query or {}
        body = body or {}
        headers = {k.lower(): v for k, v in (headers or {}).items()}

        try:
            return self._dispatch(method, route, query, body, headers)
        except ValidationError as e:
            return err("BAD_REQUEST", str(e), 400)
        except Exception as e:  # noqa: BLE001 - last-resort guard, never leak traces
            log.exception("Unhandled error")
            return err("INTERNAL", "An unexpected error occurred.", 500)

    def _dispatch(self, method, route, query, body, headers):
        # Health
        if route == "/health" and method == "GET":
            return ok({
                "status": "ok",
                "service": "investmate-ai",
                "model": config.BEDROCK_MODEL_ID,
                "region": config.BEDROCK_REGION,
                "bedrockEnabled": config.BEDROCK_ENABLED,
            })

        # Integration status (sanitized)
        if route == "/integrations/nse" and method == "GET":
            return ok(self.provider.integration_status())

        # Indices
        if route == "/indices" and method == "GET":
            r = self.provider.get_index_overview()
            return ok(r.data, r.meta())

        # Symbol search
        if route == "/stocks/search" and method == "GET":
            q = (query.get("q") or "").strip()
            r = self.provider.search_symbol(q)
            return ok(r.data, r.meta())

        # Stock history  /stocks/{symbol}/history
        if route.startswith("/stocks/") and route.endswith("/history") and method == "GET":
            symbol = validation.clean_symbol(route[len("/stocks/"):-len("/history")])
            period = validation.clean_period(query.get("period"))
            r = self.provider.get_history(symbol, period)
            data = dict(r.data) if isinstance(r.data, dict) else {"raw": r.data}
            if isinstance(r.data, dict) and "candles" in r.data:
                data["metrics"] = metrics.summarize_history(r.data["candles"])
            return ok(data, r.meta())

        # Stock quote  /stocks/{symbol}
        if route.startswith("/stocks/") and method == "GET" and route.count("/") == 2:
            symbol = validation.clean_symbol(route[len("/stocks/"):])
            r = self.provider.get_quote(symbol)
            return ok(r.data, r.meta())

        # Research (the signature agent workflow)
        if route == "/research" and method == "POST":
            return self._research(body)

        # Portfolio risk
        if route == "/portfolio/risk" and method == "POST":
            holdings = validation.clean_holdings(body.get("holdings"))
            result = portfolio_mod.analyze(holdings, self.provider)
            return ok(result, result.get("meta"))

        # Watchlist
        if route == "/watchlist" and method == "GET":
            cid = validation.clean_client_id(query.get("clientId") or headers.get("x-client-id"))
            return ok({"symbols": self.store.get_watchlist(cid)})
        if route == "/watchlist" and method == "PUT":
            cid = validation.clean_client_id(body.get("clientId") or headers.get("x-client-id"))
            raw = body.get("symbols") or []
            if not isinstance(raw, list):
                raise ValidationError("symbols must be a list.")
            symbols = [validation.clean_symbol(s) for s in raw]
            return ok({"symbols": self.store.put_watchlist(cid, symbols)})

        # Preferences
        if route == "/prefs" and method == "GET":
            cid = validation.clean_client_id(query.get("clientId") or headers.get("x-client-id"))
            return ok(self.store.get_prefs(cid))
        if route == "/prefs" and method == "PUT":
            cid = validation.clean_client_id(body.get("clientId") or headers.get("x-client-id"))
            return ok(self.store.put_prefs(cid, body.get("prefs") or {}))

        return err("NOT_FOUND", f"No route for {method} {route}", 404)

    def _research(self, body: dict):
        question = validation.clean_question(body.get("question", ""))
        symbol = None
        if body.get("symbol"):
            symbol = validation.clean_symbol(body["symbol"])
        period = validation.clean_period(body.get("period"), default="3M")
        beginner = bool(body.get("beginnerMode", True))

        agent = ResearchAgent(self.provider)
        try:
            result = agent.run(question, symbol, period, beginner)
            return ok(result)
        except BedrockUnavailable as e:
            # Preserve the user's question; never fabricate an answer.
            log.warning("Research unavailable: %s", e)
            return err(
                "AI_UNAVAILABLE",
                "I couldn't reach the AI model to analyze the data. Your question "
                "is preserved; please retry in a moment.",
                503,
            )
