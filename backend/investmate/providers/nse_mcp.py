"""Real NSE MCP provider over the official `streamable-http` transport.

This speaks the actual Model Context Protocol using the maintained `mcp` Python
SDK. It performs MCP discovery (`list_tools`) and calls discovered tools. It is
written to work the moment an endpoint is reachable from the runtime.

VERIFIED CONSTRAINT: the official NSE endpoints sit behind Akamai Bot Manager
and return 504 to headless clients, so in a Lambda/server runtime
`probe()`/calls raise `ProviderUnavailable`. The base URLs are configurable so a
browser-session proxy can be pointed at instead, at which point this provider
starts returning live data with no code change.

Tool-name mapping is defensive: NSE documents capabilities but the exact tool
names are only known at runtime via discovery, so we match discovered tools by
keyword rather than hard-coding names we have not verified.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from ..config import config
from ..models import PERIOD_DAYS, ProviderResult, ProviderUnavailable, utc_now_iso

log = logging.getLogger("investmate.nse_mcp")


def _sdk_available() -> bool:
    """True if the optional `mcp` SDK is installed in this runtime."""
    try:
        import mcp  # noqa: F401
        import mcp.client.streamable_http  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


def _run(coro, timeout: float):
    """Run an async coroutine to completion from sync code with a hard timeout."""
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(asyncio.wait_for(coro, timeout=timeout))
        finally:
            loop.close()
    except asyncio.TimeoutError as e:
        raise ProviderUnavailable("NSE MCP request timed out") from e


async def _discover(url: str, read_timeout: float) -> list[dict]:
    """Connect, initialize, and list tools. Returns [{name, description, schema}]."""
    # Imported lazily so the sample-only path has no hard dependency on the SDK.
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(url, timeout=read_timeout) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            return [
                {
                    "name": t.name,
                    "description": t.description or "",
                    "schema": getattr(t, "inputSchema", None),
                }
                for t in tools.tools
            ]


async def _call(url: str, tool: str, args: dict, read_timeout: float) -> Any:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(url, timeout=read_timeout) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool, args)
            # Normalize MCP content blocks to plain text/data.
            out = []
            for block in result.content:
                if getattr(block, "type", None) == "text":
                    out.append(block.text)
                else:
                    out.append(getattr(block, "data", str(block)))
            return out


def _match_tool(tools: list[dict], *keywords: str) -> Optional[str]:
    for t in tools:
        hay = (t["name"] + " " + t["description"]).lower()
        if all(k.lower() in hay for k in keywords):
            return t["name"]
    return None


class NseMcpProvider:
    """Live provider. Raises ProviderUnavailable when the endpoint is unreachable."""

    name = "nse-mcp"

    def __init__(self) -> None:
        self.cm_url = config.NSE_MCP_CM_URL
        self.bhav_url = config.NSE_MCP_BHAV_URL
        self.read_timeout = config.NSE_MCP_READ_TIMEOUT
        self._cm_tools: Optional[list[dict]] = None
        self._bhav_tools: Optional[list[dict]] = None

    # --- discovery / health ---
    def probe(self) -> dict:
        """Attempt discovery on both servers. Never raises; returns a status dict."""
        status = {"transport": "streamable-http", "servers": {}}
        if not _sdk_available():
            status["sdk"] = "not-installed"
            status["note"] = (
                "The optional MCP SDK is not bundled in this runtime, so live NSE "
                "calls are disabled here. The app runs in labelled sample mode. "
                "Install 'mcp' and set NSE_MCP_ENABLED=true to attempt live calls."
            )
            for key in ("cm-market", "nse-bhavcopy"):
                status["servers"][key] = {"reachable": False, "reason": "MCP SDK not installed"}
            return status
        for key, url in (("cm-market", self.cm_url), ("nse-bhavcopy", self.bhav_url)):
            try:
                tools = _run(_discover(url, self.read_timeout), self.read_timeout + 2)
                status["servers"][key] = {
                    "reachable": True,
                    "toolCount": len(tools),
                    "tools": [t["name"] for t in tools][:30],
                }
            except Exception as e:  # noqa: BLE001 - probe must not raise
                status["servers"][key] = {
                    "reachable": False,
                    "reason": _reason(e),
                }
        return status

    def _cm(self) -> list[dict]:
        if self._cm_tools is None:
            self._cm_tools = self._discover_or_fail(self.cm_url)
        return self._cm_tools

    def _bhav(self) -> list[dict]:
        if self._bhav_tools is None:
            self._bhav_tools = self._discover_or_fail(self.bhav_url)
        return self._bhav_tools

    def _discover_or_fail(self, url: str) -> list[dict]:
        last: Exception | None = None
        for _ in range(max(1, config.NSE_MCP_RETRIES + 1)):
            try:
                return _run(_discover(url, self.read_timeout), self.read_timeout + 2)
            except ProviderUnavailable as e:
                last = e
            except Exception as e:  # noqa: BLE001
                last = ProviderUnavailable(_reason(e))
        raise last or ProviderUnavailable("NSE MCP discovery failed")

    # --- capability methods ---
    def search_symbol(self, query: str, limit: int = 10) -> ProviderResult:
        tools = self._bhav()
        tool = _match_tool(tools, "search") or _match_tool(tools, "symbol")
        if not tool:
            raise ProviderUnavailable("No symbol-search tool discovered on NSE MCP")
        data = _run(_call(self.bhav_url, tool, {"query": query}, self.read_timeout),
                    self.read_timeout + 2)
        return ProviderResult(data=data, source="nse-mcp:nse-bhavcopy", as_of=utc_now_iso())

    def get_quote(self, symbol: str) -> ProviderResult:
        tools = self._cm()
        tool = _match_tool(tools, "quote") or _match_tool(tools, "stock")
        if not tool:
            raise ProviderUnavailable("No quote tool discovered on NSE MCP")
        data = _run(_call(self.cm_url, tool, {"symbol": symbol}, self.read_timeout),
                    self.read_timeout + 2)
        return ProviderResult(data=data, source="nse-mcp:cm-market", as_of=utc_now_iso())

    def get_history(self, symbol: str, period: str) -> ProviderResult:
        tools = self._bhav()
        tool = _match_tool(tools, "history") or _match_tool(tools, "price")
        if not tool:
            raise ProviderUnavailable("No history tool discovered on NSE MCP")
        days = PERIOD_DAYS.get(period.upper(), 66)
        data = _run(_call(self.bhav_url, tool, {"symbol": symbol, "days": days},
                          self.read_timeout), self.read_timeout + 2)
        return ProviderResult(
            data={"symbol": symbol, "period": period.upper(), "raw": data},
            source="nse-mcp:nse-bhavcopy",
            as_of=utc_now_iso(),
        )

    def get_index_overview(self) -> ProviderResult:
        tools = self._cm()
        tool = _match_tool(tools, "index")
        if not tool:
            raise ProviderUnavailable("No index tool discovered on NSE MCP")
        data = _run(_call(self.cm_url, tool, {}, self.read_timeout), self.read_timeout + 2)
        return ProviderResult(data=data, source="nse-mcp:cm-market", as_of=utc_now_iso())

    def get_market_movers(self) -> ProviderResult:
        tools = self._cm()
        gainers = _match_tool(tools, "gainers") or _match_tool(tools, "top")
        if not gainers:
            raise ProviderUnavailable("No market-movers tool discovered on NSE MCP")
        data = _run(_call(self.cm_url, gainers, {}, self.read_timeout), self.read_timeout + 2)
        return ProviderResult(data={"raw": data}, source="nse-mcp:cm-market", as_of=utc_now_iso())


def _reason(e: Exception) -> str:
    """Human-readable, non-leaky reason string for a failed MCP call."""
    msg = str(e)
    low = msg.lower()
    if isinstance(e, (ImportError, ModuleNotFoundError)) or "mcp" == low or "no module named 'mcp'" in low:
        return ("MCP SDK not installed in this runtime; live NSE calls disabled. "
                "Running in labelled sample mode.")
    if "504" in msg or "gateway time-out" in low or "timed out" in low or "timeout" in low:
        return ("Endpoint unreachable from this runtime: 504/timeout behind Akamai "
                "bot protection. NSE MCP responds only to interactive browser clients.")
    if "taskgroup" in low or "exceptiongroup" in low:
        return ("MCP handshake failed (connection closed before initialize) — "
                "consistent with Akamai bot protection blocking non-browser clients.")
    return f"MCP connection failed: {type(e).__name__}"
