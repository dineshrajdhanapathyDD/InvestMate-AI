"""Router and validation tests, plus health-endpoint secret hygiene."""
import json

import pytest

from investmate.router import Router
from investmate.lambda_handler import handler as lambda_handler


@pytest.fixture
def router():
    return Router()


def call(router, method, path, query=None, body=None, headers=None):
    return router.handle(method, path, query or {}, body or {}, headers or {})


# --- validation ---
def test_invalid_symbol_rejected(router):
    status, body = call(router, "GET", "/api/v1/stocks/bad!sym")
    assert status == 400 and body["error"]["code"] == "BAD_REQUEST"


def test_invalid_period_rejected(router):
    status, body = call(router, "GET", "/api/v1/stocks/TCS/history", {"period": "77X"})
    assert status == 400


def test_empty_question_rejected(router):
    status, body = call(router, "POST", "/api/v1/research", body={"question": "  "})
    assert status == 400


def test_too_long_question_rejected(router):
    status, body = call(router, "POST", "/api/v1/research", body={"question": "x" * 1001})
    assert status == 400


def test_empty_holdings_rejected(router):
    status, body = call(router, "POST", "/api/v1/portfolio/risk", body={"holdings": []})
    assert status == 400


def test_unknown_route_404(router):
    status, body = call(router, "GET", "/api/v1/nope")
    assert status == 404


# --- happy paths ---
def test_quote_ok_and_labelled(router):
    status, body = call(router, "GET", "/api/v1/stocks/RELIANCE")
    assert status == 200 and body["ok"] is True
    assert body["meta"]["isSample"] is True


def test_history_includes_metrics(router):
    status, body = call(router, "GET", "/api/v1/stocks/TCS/history", {"period": "1Y"})
    assert status == 200
    assert "metrics" in body["data"]
    assert body["data"]["metrics"]["observations"] > 0


def test_watchlist_roundtrip(router):
    s1, _ = call(router, "PUT", "/api/v1/watchlist",
                 body={"clientId": "u1", "symbols": ["TCS", "INFY"]})
    assert s1 == 200
    s2, body = call(router, "GET", "/api/v1/watchlist", {"clientId": "u1"})
    assert s2 == 200 and body["data"]["symbols"] == ["TCS", "INFY"]


def test_portfolio_risk_ok(router):
    status, body = call(router, "POST", "/api/v1/portfolio/risk", body={
        "holdings": [{"symbol": "TCS", "quantity": 10}, {"symbol": "SBIN", "quantity": 20}]})
    assert status == 200
    assert body["data"]["totalValue"] > 0
    assert body["data"]["largestHolding"] is not None
    assert any("volatility" in l.lower() for l in body["data"]["limitations"])


# --- secret hygiene ---
def test_health_has_no_secrets(router):
    status, body = call(router, "GET", "/api/v1/health")
    assert status == 200
    blob = json.dumps(body).lower()
    for leak in ("secret", "password", "token", "aws_access", "credential", "traceback"):
        assert leak not in blob


def test_integrations_has_no_full_urls_or_secrets(router):
    status, body = call(router, "GET", "/api/v1/integrations/nse")
    assert status == 200
    blob = json.dumps(body)
    assert "https://" not in blob  # host only, no full URL
    assert "secret" not in blob.lower()


# --- lambda proxy wrapper ---
def test_lambda_handler_wraps_response():
    event = {"httpMethod": "GET", "path": "/api/v1/health", "headers": {}}
    resp = lambda_handler(event, None)
    assert resp["statusCode"] == 200
    assert resp["headers"]["Content-Type"] == "application/json"
    assert "Access-Control-Allow-Origin" in resp["headers"]
    assert json.loads(resp["body"])["ok"] is True


def test_lambda_handler_rejects_bad_json():
    event = {"httpMethod": "POST", "path": "/api/v1/research", "headers": {}, "body": "{bad"}
    resp = lambda_handler(event, None)
    assert resp["statusCode"] == 400
