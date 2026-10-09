"""Simple, honest derived metrics computed only when enough data exists."""
from __future__ import annotations

import math
from typing import Optional


def period_return_pct(candles: list[dict]) -> Optional[float]:
    if len(candles) < 2:
        return None
    first = candles[0]["close"]
    last = candles[-1]["close"]
    if not first:
        return None
    return round((last - first) / first * 100, 2)


def high_low(candles: list[dict]) -> dict:
    if not candles:
        return {"high": None, "low": None}
    highs = [c["high"] for c in candles]
    lows = [c["low"] for c in candles]
    return {"high": round(max(highs), 2), "low": round(min(lows), 2)}


def avg_volume(candles: list[dict]) -> Optional[int]:
    if not candles:
        return None
    return int(sum(c["volume"] for c in candles) / len(candles))


# Minimum daily observations required before we are willing to quote a
# volatility number. Below this, we return None and explain why rather than
# produce a misleading figure.
MIN_VOL_OBS = 20


def annualized_volatility_pct(candles: list[dict]) -> Optional[float]:
    """Annualized stdev of daily log returns, or None if insufficient data."""
    closes = [c["close"] for c in candles if c.get("close")]
    if len(closes) < MIN_VOL_OBS:
        return None
    rets = []
    for i in range(1, len(closes)):
        prev, cur = closes[i - 1], closes[i]
        if prev > 0 and cur > 0:
            rets.append(math.log(cur / prev))
    if len(rets) < MIN_VOL_OBS - 1:
        return None
    mean = sum(rets) / len(rets)
    var = sum((r - mean) ** 2 for r in rets) / (len(rets) - 1)
    daily = math.sqrt(var)
    return round(daily * math.sqrt(252) * 100, 2)


def summarize_history(candles: list[dict]) -> dict:
    """Bundle the derived metrics with explicit sufficiency flags."""
    vol = annualized_volatility_pct(candles)
    hl = high_low(candles)
    return {
        "observations": len(candles),
        "periodReturnPct": period_return_pct(candles),
        "high": hl["high"],
        "low": hl["low"],
        "avgVolume": avg_volume(candles),
        "annualizedVolatilityPct": vol,
        "volatilitySufficient": vol is not None,
        "volatilityNote": (
            None if vol is not None
            else f"Not enough price history (need at least {MIN_VOL_OBS} observations) "
                 "to estimate volatility reliably."
        ),
    }
