"""Shared data structures for market data and provider results."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class ProviderUnavailable(Exception):
    """Raised when a live data provider cannot satisfy a request."""


@dataclass
class ProviderResult:
    """Every piece of market data carries its provenance.

    `is_sample` is the single source of truth the UI uses to label
    demonstration data. We never set it to False for data that did not come
    from a live source.
    """

    data: Any
    source: str          # e.g. "nse-mcp:cm-market", "nse-mcp:nse-bhavcopy", "sample-data"
    as_of: str = field(default_factory=utc_now_iso)
    is_sample: bool = False
    note: Optional[str] = None

    def meta(self) -> dict:
        return {
            "source": self.source,
            "asOf": self.as_of,
            "isSample": self.is_sample,
            "note": self.note,
        }


@dataclass
class Quote:
    symbol: str
    name: str
    last_price: float
    change: float
    change_pct: float
    day_high: float
    day_low: float
    volume: int

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "name": self.name,
            "lastPrice": round(self.last_price, 2),
            "change": round(self.change, 2),
            "changePct": round(self.change_pct, 2),
            "dayHigh": round(self.day_high, 2),
            "dayLow": round(self.day_low, 2),
            "volume": self.volume,
        }


@dataclass
class Candle:
    date: str   # YYYY-MM-DD
    open: float
    high: float
    low: float
    close: float
    volume: int

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "open": round(self.open, 2),
            "high": round(self.high, 2),
            "low": round(self.low, 2),
            "close": round(self.close, 2),
            "volume": self.volume,
        }


@dataclass
class IndexSnapshot:
    name: str
    value: float
    change: float
    change_pct: float

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "value": round(self.value, 2),
            "change": round(self.change, 2),
            "changePct": round(self.change_pct, 2),
        }


# Periods supported by the history endpoint, mapped to approximate trading days.
PERIOD_DAYS = {
    "1W": 5,
    "1M": 22,
    "3M": 66,
    "6M": 126,
    "1Y": 252,
    "5Y": 1260,
}
