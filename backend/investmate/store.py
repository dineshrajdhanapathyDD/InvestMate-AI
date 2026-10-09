"""DynamoDB-backed persistence for watchlist and preferences.

Single table keyed by pk=CLIENT#<id>, sk in {WATCHLIST, PREFS}. Falls back to an
in-memory store when DynamoDB is disabled (local dev / tests).
"""
from __future__ import annotations

import logging
from typing import Optional

from .config import config

log = logging.getLogger("investmate.store")

_MEMORY: dict[str, dict] = {}


class Store:
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.table_name = table_name or config.TABLE_NAME
        self.enabled = config.DYNAMODB_ENABLED
        self._table = None
        self._resource = client

    def _tbl(self):
        if self._table is None:
            import boto3
            res = self._resource or boto3.resource("dynamodb", region_name=config.BEDROCK_REGION)
            self._table = res.Table(self.table_name)
        return self._table

    # --- watchlist ---
    def get_watchlist(self, client_id: str) -> list[str]:
        if not self.enabled:
            return list(_MEMORY.get(f"{client_id}#WATCHLIST", {}).get("symbols", []))
        try:
            resp = self._tbl().get_item(Key={"pk": f"CLIENT#{client_id}", "sk": "WATCHLIST"})
            item = resp.get("Item") or {}
            return list(item.get("symbols", []))
        except Exception as e:  # noqa: BLE001
            log.warning("get_watchlist failed: %s", e)
            return []

    def put_watchlist(self, client_id: str, symbols: list[str]) -> list[str]:
        symbols = list(dict.fromkeys(symbols))[:100]  # dedupe, cap
        if not self.enabled:
            _MEMORY[f"{client_id}#WATCHLIST"] = {"symbols": symbols}
            return symbols
        try:
            self._tbl().put_item(Item={
                "pk": f"CLIENT#{client_id}", "sk": "WATCHLIST", "symbols": symbols,
            })
        except Exception as e:  # noqa: BLE001
            log.warning("put_watchlist failed: %s", e)
        return symbols

    # --- preferences ---
    def get_prefs(self, client_id: str) -> dict:
        if not self.enabled:
            return dict(_MEMORY.get(f"{client_id}#PREFS", {"beginnerMode": True}))
        try:
            resp = self._tbl().get_item(Key={"pk": f"CLIENT#{client_id}", "sk": "PREFS"})
            item = resp.get("Item") or {}
            return {"beginnerMode": bool(item.get("beginnerMode", True))}
        except Exception as e:  # noqa: BLE001
            log.warning("get_prefs failed: %s", e)
            return {"beginnerMode": True}

    def put_prefs(self, client_id: str, prefs: dict) -> dict:
        clean = {"beginnerMode": bool(prefs.get("beginnerMode", True))}
        if not self.enabled:
            _MEMORY[f"{client_id}#PREFS"] = clean
            return clean
        try:
            self._tbl().put_item(Item={
                "pk": f"CLIENT#{client_id}", "sk": "PREFS", **clean,
            })
        except Exception as e:  # noqa: BLE001
            log.warning("put_prefs failed: %s", e)
        return clean
