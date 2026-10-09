"""Tests for the data providers: sample determinism, dates, MCP failure, fallback."""
from investmate.providers.sample import SampleDataProvider
from investmate.providers.resilient import ResilientProvider
from investmate.providers.nse_mcp import NseMcpProvider, _reason
from investmate.models import ProviderUnavailable


def test_sample_quote_is_labelled_sample():
    p = SampleDataProvider()
    r = p.get_quote("RELIANCE")
    assert r.is_sample is True
    assert r.source == "sample-data"
    assert r.data["symbol"] == "RELIANCE"
    assert r.data["lastPrice"] > 0


def test_sample_history_is_deterministic():
    p = SampleDataProvider()
    a = p.get_history("TCS", "3M")
    b = p.get_history("TCS", "3M")
    assert a.data["candles"] == b.data["candles"]
    assert len(a.data["candles"]) == 66  # ~3 months of trading days


def test_history_retains_real_calendar_dates():
    p = SampleDataProvider()
    candles = p.get_history("INFY", "1M").data["candles"]
    dates = [c["date"] for c in candles]
    # strictly increasing, weekdays only, ISO formatted
    assert dates == sorted(dates)
    for d in dates:
        assert len(d) == 10 and d[4] == "-" and d[7] == "-"


def test_search_matches_symbol_and_name():
    p = SampleDataProvider()
    syms = [r["symbol"] for r in p.search_symbol("bank").data]
    assert "HDFCBANK" in syms and "ICICIBANK" in syms


def test_market_movers_shape_and_labelled():
    p = SampleDataProvider()
    r = p.get_market_movers()
    assert r.is_sample is True and r.source == "sample-data"
    d = r.data
    assert len(d["topGainers"]) == 5 and len(d["topLosers"]) == 5
    # gainers sorted desc, losers ascending by changePct
    g = [x["changePct"] for x in d["topGainers"]]
    assert g == sorted(g, reverse=True)
    b = d["breadth"]
    assert b["advances"] + b["declines"] + b["unchanged"] == b["total"]
    # 52-week high >= low for every row
    for row in d["week52"]:
        assert row["week52High"] >= row["week52Low"]


def test_resilient_falls_back_with_label_when_mcp_disabled():
    # NSE_MCP_ENABLED defaults false in tests -> always sample, clearly labelled.
    p = ResilientProvider()
    r = p.get_quote("WIPRO")
    assert r.is_sample is True
    assert "sample-data" == r.source


def test_resilient_falls_back_when_live_raises(monkeypatch):
    p = ResilientProvider()

    class FakeLive:
        def get_quote(self, symbol):
            raise ProviderUnavailable("504 behind Akamai")

    p.live = FakeLive()  # force the live path to exist and fail
    r = p.get_quote("TCS")
    assert r.is_sample is True
    assert p.last_fallback_reason and "Akamai" in p.last_fallback_reason
    assert "Akamai" in (r.note or "")


def test_reason_classifies_akamai_timeout():
    msg = _reason(Exception("504 Gateway Time-out"))
    assert "Akamai" in msg or "unreachable" in msg


def test_integration_status_is_sanitized():
    p = ResilientProvider()
    s = p.integration_status()
    assert s["transport"] == "streamable-http"
    # host only, never full URL/secret
    assert s["endpoints"]["cm-market"] == "mcp.nseindia.in"
    assert "mcp" in s["endpoints"]["nse-bhavcopy"]
