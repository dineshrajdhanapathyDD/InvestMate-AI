"""Lightweight portfolio-risk calculations with honest limitations."""
from __future__ import annotations

from . import catalog, metrics
from .providers.resilient import ResilientProvider

LIMITATIONS = [
    "These figures describe past data only. Historical volatility does not "
    "predict future returns.",
    "Diversification can reduce some risk but does not remove it.",
    "Allocation uses the latest available price per holding; sample data is "
    "labelled as such.",
]


def analyze(holdings: list[dict], provider: ResilientProvider) -> dict:
    """holdings: [{symbol, quantity, price?}]. Returns allocation + concentration
    + sector + per-holding volatility where enough history exists."""
    rows = []
    is_sample_any = False
    source_label = None

    for h in holdings:
        symbol = catalog.resolve_symbol(h.get("symbol", ""))
        qty = float(h.get("quantity") or 0)
        price = h.get("price")
        if price is None:
            q = provider.get_quote(symbol)
            price = q.data.get("lastPrice", 0.0)
            is_sample_any = is_sample_any or q.is_sample
            source_label = q.source
        value = qty * float(price)
        rows.append({
            "symbol": symbol,
            "name": catalog.company_name(symbol),
            "sector": catalog.sector_of(symbol) or "Unclassified",
            "quantity": qty,
            "price": round(float(price), 2),
            "value": round(value, 2),
        })

    total = sum(r["value"] for r in rows) or 0.0
    for r in rows:
        r["allocationPct"] = round(r["value"] / total * 100, 2) if total else 0.0

    # Concentration: largest single holding + sector breakdown.
    largest = max(rows, key=lambda r: r["value"], default=None)
    sectors: dict[str, float] = {}
    for r in rows:
        sectors[r["sector"]] = sectors.get(r["sector"], 0.0) + r["value"]
    sector_alloc = [
        {"sector": s, "allocationPct": round(v / total * 100, 2) if total else 0.0}
        for s, v in sorted(sectors.items(), key=lambda kv: -kv[1])
    ]

    # Per-holding annualized volatility from 6M history, where sufficient.
    for r in rows:
        hist = provider.get_history(r["symbol"], "6M")
        is_sample_any = is_sample_any or hist.is_sample
        candles = hist.data.get("candles", []) if isinstance(hist.data, dict) else []
        r["annualizedVolatilityPct"] = metrics.annualized_volatility_pct(candles)

    return {
        "totalValue": round(total, 2),
        "holdings": rows,
        "largestHolding": (
            {"symbol": largest["symbol"], "allocationPct": largest["allocationPct"]}
            if largest else None
        ),
        "sectorAllocation": sector_alloc,
        "limitations": LIMITATIONS,
        "meta": {
            "source": source_label or "sample-data",
            "isSample": is_sample_any,
        },
    }
