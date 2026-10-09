"""Deterministic, offline sample-data provider.

Every value is reproducible (seeded by symbol) so charts, metrics and tests are
stable across runs. All results carry `is_sample=True` and
`source="sample-data"`. This provider must NEVER be presented to the user as
live NSE data; the UI reads `is_sample` to show a visible demonstration label.
"""
from __future__ import annotations

import hashlib
import math
import random
from datetime import date, timedelta

from .. import catalog
from ..models import (
    Candle,
    IndexSnapshot,
    PERIOD_DAYS,
    ProviderResult,
    Quote,
    utc_now_iso,
)

_SAMPLE_NOTE = (
    "Demonstration data generated locally. The official NSE MCP endpoints are "
    "reachable only from interactive browser clients (Akamai bot protection), "
    "so this is not live NSE data."
)


def _seed(symbol: str) -> int:
    h = hashlib.sha256(symbol.encode("utf-8")).hexdigest()
    return int(h[:8], 16)


def _weekday_dates(n: int, end: date | None = None) -> list[date]:
    """Return the last `n` weekdays, oldest first, ending at `end` (default today)."""
    end = end or date.today()
    out: list[date] = []
    d = end
    while len(out) < n:
        if d.weekday() < 5:  # Mon-Fri
            out.append(d)
        d -= timedelta(days=1)
    return list(reversed(out))


def _series(symbol: str, days: int) -> list[Candle]:
    rng = random.Random(_seed(symbol) + days)
    price = catalog.base_price(symbol)
    # A gentle drift + volatility that differs per symbol but is deterministic.
    drift = (rng.random() - 0.5) * 0.0015
    vol = 0.012 + rng.random() * 0.012
    candles: list[Candle] = []
    for d in _weekday_dates(days):
        shock = rng.gauss(0, 1) * vol
        change = drift + shock
        open_p = price
        close_p = max(1.0, open_p * (1 + change))
        high_p = max(open_p, close_p) * (1 + abs(rng.gauss(0, 1)) * vol * 0.4)
        low_p = min(open_p, close_p) * (1 - abs(rng.gauss(0, 1)) * vol * 0.4)
        volume = int(200_000 + abs(rng.gauss(0, 1)) * 800_000)
        candles.append(
            Candle(
                date=d.isoformat(),
                open=open_p,
                high=high_p,
                low=low_p,
                close=close_p,
                volume=volume,
            )
        )
        price = close_p
    return candles


class SampleDataProvider:
    name = "sample-data"

    def search_symbol(self, query: str, limit: int = 10) -> ProviderResult:
        return ProviderResult(
            data=catalog.search(query, limit),
            source="sample-data",
            is_sample=True,
            note=_SAMPLE_NOTE,
        )

    def get_quote(self, symbol: str) -> ProviderResult:
        sym = catalog.resolve_symbol(symbol)
        candles = _series(sym, 2)
        today = candles[-1]
        prev_close = candles[-2].close if len(candles) > 1 else today.open
        change = today.close - prev_close
        change_pct = (change / prev_close) * 100 if prev_close else 0.0
        quote = Quote(
            symbol=sym,
            name=catalog.company_name(sym),
            last_price=today.close,
            change=change,
            change_pct=change_pct,
            day_high=today.high,
            day_low=today.low,
            volume=today.volume,
        )
        return ProviderResult(
            data=quote.to_dict(),
            source="sample-data",
            as_of=utc_now_iso(),
            is_sample=True,
            note=_SAMPLE_NOTE,
        )

    def get_history(self, symbol: str, period: str) -> ProviderResult:
        sym = catalog.resolve_symbol(symbol)
        days = PERIOD_DAYS.get(period.upper(), 66)
        candles = _series(sym, days)
        return ProviderResult(
            data={
                "symbol": sym,
                "period": period.upper(),
                "candles": [c.to_dict() for c in candles],
            },
            source="sample-data",
            as_of=utc_now_iso(),
            is_sample=True,
            note=_SAMPLE_NOTE,
        )

    def get_index_overview(self) -> ProviderResult:
        snaps = []
        for name, base in catalog.INDEX_BASE.items():
            rng = random.Random(_seed(name))
            change_pct = (rng.random() - 0.5) * 1.6
            change = base * change_pct / 100
            snaps.append(IndexSnapshot(name, base + change, change, change_pct).to_dict())
        return ProviderResult(
            data=snaps,
            source="sample-data",
            as_of=utc_now_iso(),
            is_sample=True,
            note=_SAMPLE_NOTE,
        )
