"""Request validation helpers. Reject malformed input with clear messages."""
from __future__ import annotations

import re

SYMBOL_RE = re.compile(r"^[A-Z0-9&\-]{1,20}$")
VALID_PERIODS = {"1W", "1M", "3M", "6M", "1Y", "5Y"}
MAX_QUESTION_LEN = 1000
MAX_HOLDINGS = 50


class ValidationError(ValueError):
    pass


def clean_symbol(raw: str) -> str:
    sym = (raw or "").strip().upper()
    if not SYMBOL_RE.match(sym):
        raise ValidationError(
            "Invalid symbol. Use 1-20 characters: letters, digits, & or -."
        )
    return sym


def clean_period(raw: str | None, default: str = "3M") -> str:
    if raw is None or raw == "":
        return default
    p = raw.strip().upper()
    if p not in VALID_PERIODS:
        raise ValidationError(
            f"Invalid period '{raw}'. Allowed: {', '.join(sorted(VALID_PERIODS))}."
        )
    return p


def clean_question(raw: str) -> str:
    q = (raw or "").strip()
    if not q:
        raise ValidationError("Question must not be empty.")
    if len(q) > MAX_QUESTION_LEN:
        raise ValidationError(f"Question too long (max {MAX_QUESTION_LEN} characters).")
    return q


def clean_client_id(raw: str | None) -> str:
    cid = (raw or "").strip()
    if not cid or len(cid) > 100 or not re.match(r"^[A-Za-z0-9\-_]+$", cid):
        raise ValidationError("Invalid or missing client id.")
    return cid


def clean_holdings(raw) -> list[dict]:
    if not isinstance(raw, list) or not raw:
        raise ValidationError("Provide a non-empty list of holdings.")
    if len(raw) > MAX_HOLDINGS:
        raise ValidationError(f"Too many holdings (max {MAX_HOLDINGS}).")
    out = []
    for h in raw:
        if not isinstance(h, dict):
            raise ValidationError("Each holding must be an object.")
        sym = clean_symbol(h.get("symbol", ""))
        try:
            qty = float(h.get("quantity"))
        except (TypeError, ValueError):
            raise ValidationError(f"Holding {sym}: quantity must be a number.")
        if qty <= 0:
            raise ValidationError(f"Holding {sym}: quantity must be positive.")
        item = {"symbol": sym, "quantity": qty}
        if h.get("price") is not None:
            try:
                price = float(h["price"])
            except (TypeError, ValueError):
                raise ValidationError(f"Holding {sym}: price must be a number.")
            if price < 0:
                raise ValidationError(f"Holding {sym}: price cannot be negative.")
            item["price"] = price
        out.append(item)
    return out
