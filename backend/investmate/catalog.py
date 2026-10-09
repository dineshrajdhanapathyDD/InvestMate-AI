"""A small catalog of well-known NSE-listed symbols for search and sector data.

This is reference metadata (names/sectors), not market prices. It supports the
symbol-search feature and sector allocation in the portfolio tool. Prices are
never taken from here.
"""
from __future__ import annotations

# symbol -> (company name, sector, a plausible base price for sample series)
NSE_CATALOG: dict[str, tuple[str, str, float]] = {
    "RELIANCE": ("Reliance Industries Ltd", "Energy", 2900.0),
    "TCS": ("Tata Consultancy Services Ltd", "IT", 3850.0),
    "INFY": ("Infosys Ltd", "IT", 1550.0),
    "HDFCBANK": ("HDFC Bank Ltd", "Financials", 1680.0),
    "ICICIBANK": ("ICICI Bank Ltd", "Financials", 1150.0),
    "SBIN": ("State Bank of India", "Financials", 820.0),
    "BHARTIARTL": ("Bharti Airtel Ltd", "Telecom", 1480.0),
    "ITC": ("ITC Ltd", "FMCG", 440.0),
    "LT": ("Larsen & Toubro Ltd", "Construction", 3600.0),
    "KOTAKBANK": ("Kotak Mahindra Bank Ltd", "Financials", 1750.0),
    "HINDUNILVR": ("Hindustan Unilever Ltd", "FMCG", 2450.0),
    "AXISBANK": ("Axis Bank Ltd", "Financials", 1180.0),
    "ASIANPAINT": ("Asian Paints Ltd", "Consumer", 2900.0),
    "MARUTI": ("Maruti Suzuki India Ltd", "Automobile", 12800.0),
    "SUNPHARMA": ("Sun Pharmaceutical Industries Ltd", "Pharma", 1620.0),
    "TATAMOTORS": ("Tata Motors Ltd", "Automobile", 980.0),
    "WIPRO": ("Wipro Ltd", "IT", 530.0),
    "TATASTEEL": ("Tata Steel Ltd", "Metals", 155.0),
    "TITAN": ("Titan Company Ltd", "Consumer", 3400.0),
    "NESTLEIND": ("Nestle India Ltd", "FMCG", 2500.0),
    "BAJFINANCE": ("Bajaj Finance Ltd", "Financials", 7200.0),
    "ADANIENT": ("Adani Enterprises Ltd", "Conglomerate", 2950.0),
    "POWERGRID": ("Power Grid Corporation of India Ltd", "Utilities", 320.0),
    "NTPC": ("NTPC Ltd", "Utilities", 360.0),
    "ONGC": ("Oil & Natural Gas Corporation Ltd", "Energy", 265.0),
}

INDEX_BASE = {
    "NIFTY 50": 24850.0,
    "SENSEX": 81500.0,
}


def resolve_symbol(raw: str) -> str:
    return (raw or "").strip().upper()


def is_known(symbol: str) -> bool:
    return resolve_symbol(symbol) in NSE_CATALOG


def search(query: str, limit: int = 10) -> list[dict]:
    q = (query or "").strip().upper()
    if not q:
        return []
    results = []
    for sym, (name, sector, _price) in NSE_CATALOG.items():
        if q in sym or q in name.upper():
            results.append({"symbol": sym, "name": name, "sector": sector})
        if len(results) >= limit:
            break
    return results


def company_name(symbol: str) -> str:
    sym = resolve_symbol(symbol)
    entry = NSE_CATALOG.get(sym)
    return entry[0] if entry else sym


def sector_of(symbol: str) -> str | None:
    sym = resolve_symbol(symbol)
    entry = NSE_CATALOG.get(sym)
    return entry[1] if entry else None


def base_price(symbol: str) -> float:
    sym = resolve_symbol(symbol)
    entry = NSE_CATALOG.get(sym)
    return entry[2] if entry else 500.0
