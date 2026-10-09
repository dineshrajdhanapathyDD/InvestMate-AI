"""Resilient provider: live NSE MCP first, labelled sample fallback second.

The fallback is explicit and honest: results carry `is_sample=True` and a note
explaining why live data was unavailable. Sample data is never relabelled as
live.
"""
from __future__ import annotations

import logging

from ..config import config
from ..models import ProviderResult, ProviderUnavailable
from .nse_mcp import NseMcpProvider, _reason
from .sample import SampleDataProvider

log = logging.getLogger("investmate.provider")


class ResilientProvider:
    name = "resilient"

    def __init__(self) -> None:
        self.sample = SampleDataProvider()
        self.live = NseMcpProvider() if config.NSE_MCP_ENABLED else None
        self.last_fallback_reason: str | None = None

    def _try_live(self, method: str, *args, **kwargs) -> ProviderResult | None:
        if not self.live:
            self.last_fallback_reason = "NSE MCP disabled (NSE_MCP_ENABLED=false)."
            return None
        try:
            return getattr(self.live, method)(*args, **kwargs)
        except ProviderUnavailable as e:
            self.last_fallback_reason = str(e)
            log.info("Live NSE MCP unavailable for %s: %s", method, e)
            return None
        except Exception as e:  # noqa: BLE001 - any live failure => fallback
            self.last_fallback_reason = _reason(e)
            log.info("Live NSE MCP error for %s: %s", method, e)
            return None

    def _with_fallback(self, result: ProviderResult | None, fallback: ProviderResult) -> ProviderResult:
        if result is not None:
            return result
        if self.last_fallback_reason:
            base = fallback.note or ""
            fallback.note = (base + " (" + self.last_fallback_reason + ")").strip()
        return fallback

    def search_symbol(self, query: str, limit: int = 10) -> ProviderResult:
        return self._with_fallback(
            self._try_live("search_symbol", query, limit),
            self.sample.search_symbol(query, limit),
        )

    def get_quote(self, symbol: str) -> ProviderResult:
        return self._with_fallback(
            self._try_live("get_quote", symbol),
            self.sample.get_quote(symbol),
        )

    def get_history(self, symbol: str, period: str) -> ProviderResult:
        return self._with_fallback(
            self._try_live("get_history", symbol, period),
            self.sample.get_history(symbol, period),
        )

    def get_index_overview(self) -> ProviderResult:
        return self._with_fallback(
            self._try_live("get_index_overview"),
            self.sample.get_index_overview(),
        )

    def get_market_movers(self) -> ProviderResult:
        return self._with_fallback(
            self._try_live("get_market_movers"),
            self.sample.get_market_movers(),
        )

    def integration_status(self) -> dict:
        """Sanitized status for GET /api/v1/integrations/nse."""
        status = {
            "enabled": config.NSE_MCP_ENABLED,
            "transport": "streamable-http",
            "endpoints": config.sanitized_mcp_hosts(),
            "mode": "live" if config.NSE_MCP_ENABLED else "sample",
        }
        if self.live:
            status["probe"] = self.live.probe()
            reachable = any(
                s.get("reachable")
                for s in status["probe"].get("servers", {}).values()
            )
            status["mode"] = "live" if reachable else "sample-fallback"
        else:
            status["probe"] = {
                "note": "Live probing disabled. Set NSE_MCP_ENABLED=true to attempt discovery."
            }
        return status
