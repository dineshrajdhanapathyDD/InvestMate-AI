"""Tests for derived metrics, including the insufficient-data volatility guard."""
from investmate import metrics
from investmate.providers.sample import SampleDataProvider


def _candles(symbol, period):
    return SampleDataProvider().get_history(symbol, period).data["candles"]


def test_period_return_and_hilo():
    c = _candles("RELIANCE", "6M")
    r = metrics.period_return_pct(c)
    assert r is not None
    hl = metrics.high_low(c)
    assert hl["high"] >= hl["low"]


def test_volatility_returns_none_for_insufficient_data():
    c = _candles("TCS", "1W")  # 5 observations, below MIN_VOL_OBS
    assert metrics.annualized_volatility_pct(c) is None
    summary = metrics.summarize_history(c)
    assert summary["volatilitySufficient"] is False
    assert summary["annualizedVolatilityPct"] is None
    assert "at least" in summary["volatilityNote"]


def test_volatility_computed_with_enough_data():
    c = _candles("INFY", "1Y")  # 252 observations
    v = metrics.annualized_volatility_pct(c)
    assert v is not None and v > 0
    summary = metrics.summarize_history(c)
    assert summary["volatilitySufficient"] is True


def test_period_return_none_for_single_point():
    assert metrics.period_return_pct([{"close": 100.0}]) is None
