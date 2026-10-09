"""Bedrock agent orchestrator using the Converse API with controlled tool use.

The model may REQUEST tools, but only the backend executes them against the
MarketDataProvider. The model never produces tool results itself. Every claim in
the final answer is meant to be grounded in the `evidence` we actually gathered,
which we return alongside the answer so the UI (and tests) can verify grounding.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from . import catalog, metrics
from .config import config
from .providers.resilient import ResilientProvider

log = logging.getLogger("investmate.agent")

MAX_TOOL_ROUNDS = 3


class BedrockUnavailable(Exception):
    """Raised when the model cannot be invoked. The caller must not fabricate."""


# --- Tool declarations given to the model via Converse toolConfig ---
TOOL_SPECS = [
    {
        "toolSpec": {
            "name": "search_symbol",
            "description": "Resolve an NSE ticker from a company name or partial symbol.",
            "inputSchema": {"json": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            }},
        }
    },
    {
        "toolSpec": {
            "name": "get_quote",
            "description": "Latest available quote for an NSE symbol (price, change, volume).",
            "inputSchema": {"json": {
                "type": "object",
                "properties": {"symbol": {"type": "string"}},
                "required": ["symbol"],
            }},
        }
    },
    {
        "toolSpec": {
            "name": "get_history",
            "description": ("Historical OHLCV candles plus derived metrics (period "
                            "return, high/low, average volume, volatility when "
                            "sufficient) for an NSE symbol over a period."),
            "inputSchema": {"json": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "period": {
                        "type": "string",
                        "enum": ["1W", "1M", "3M", "6M", "1Y", "5Y"],
                    },
                },
                "required": ["symbol"],
            }},
        }
    },
    {
        "toolSpec": {
            "name": "get_index_overview",
            "description": "Snapshot of NIFTY 50 and SENSEX.",
            "inputSchema": {"json": {"type": "object", "properties": {}}},
        }
    },
]


SYSTEM_BASE = (
    "You are InvestMate AI, a careful research companion for Indian retail "
    "investors learning about NSE-listed stocks. Rules you must always follow:\n"
    "- Ground every factual claim in the values returned by the tools. Never "
    "invent prices, dates, percentages or volumes.\n"
    "- If you did not call a tool, do not claim you retrieved data.\n"
    "- Clearly separate confirmed facts from possible interpretations. Do not "
    "confuse correlation with causation.\n"
    "- If the evidence cannot explain a price movement, say so plainly.\n"
    "- Never give guaranteed buy/sell predictions or promises of profit. Avoid "
    "alarming language and artificial urgency.\n"
    "- When data is labelled as demonstration/sample data, mention that the "
    "figures are illustrative, not live NSE data.\n"
    "- Keep the answer concise and readable."
)

BEGINNER_ADDON = (
    "\n\nBEGINNER MODE IS ON. Structure your answer in exactly three short "
    "sections with these headings:\n"
    "**What the data shows** — state the verified values, changes and dates.\n"
    "**What it might mean** — give cautious possible interpretations without "
    "claiming cause.\n"
    "**What to research next** — suggest one concrete next question or source.\n"
    "Explain any financial term in plain English the first time you use it."
)


class ResearchAgent:
    def __init__(self, provider: ResilientProvider, bedrock_client=None):
        self.provider = provider
        self._client = bedrock_client  # injectable for tests
        self.evidence: list[dict] = []

    # --- tool execution (backend-controlled) ---
    def _execute_tool(self, name: str, args: dict) -> dict:
        try:
            if name == "search_symbol":
                r = self.provider.search_symbol(args.get("query", ""))
            elif name == "get_quote":
                r = self.provider.get_quote(args.get("symbol", ""))
            elif name == "get_history":
                period = (args.get("period") or "3M").upper()
                r = self.provider.get_history(args.get("symbol", ""), period)
                if isinstance(r.data, dict) and "candles" in r.data:
                    r.data["metrics"] = metrics.summarize_history(r.data["candles"])
            elif name == "get_index_overview":
                r = self.provider.get_index_overview()
            else:
                return {"error": f"unknown tool {name}"}
        except Exception as e:  # noqa: BLE001
            return {"error": f"tool execution failed: {type(e).__name__}"}

        record = {"tool": name, "args": args, "result": r.data, "meta": r.meta()}
        self.evidence.append(record)
        return {"data": r.data, "meta": r.meta()}

    def _client_or_create(self):
        if self._client is not None:
            return self._client
        import boto3
        self._client = boto3.client("bedrock-runtime", region_name=config.BEDROCK_REGION)
        return self._client

    def run(self, question: str, symbol: str | None, period: str | None,
            beginner_mode: bool) -> dict:
        """Returns {answer, evidence, sources, usedTools, isSample}.

        Raises BedrockUnavailable if the model cannot be invoked — the caller
        returns a structured error rather than a fabricated answer.
        """
        if not config.BEDROCK_ENABLED:
            raise BedrockUnavailable("Bedrock disabled (BEDROCK_ENABLED=false)")

        self.evidence = []
        system_text = SYSTEM_BASE + (BEGINNER_ADDON if beginner_mode else "")

        hint = question
        if symbol:
            hint += f"\n(Context: the user is asking about NSE symbol {catalog.resolve_symbol(symbol)}.)"
        if period:
            hint += f"\n(Preferred period: {period}.)"

        messages = [{"role": "user", "content": [{"text": hint}]}]
        client = self._client_or_create()

        try:
            for _ in range(MAX_TOOL_ROUNDS):
                resp = client.converse(
                    modelId=config.BEDROCK_MODEL_ID,
                    system=[{"text": system_text}],
                    messages=messages,
                    toolConfig={"tools": TOOL_SPECS},
                    inferenceConfig={"maxTokens": config.BEDROCK_MAX_TOKENS,
                                     "temperature": 0.2},
                )
                out = resp["output"]["message"]
                messages.append(out)
                stop = resp.get("stopReason")

                if stop == "tool_use":
                    tool_results = []
                    for block in out.get("content", []):
                        tu = block.get("toolUse")
                        if not tu:
                            continue
                        result = self._execute_tool(tu["name"], tu.get("input", {}) or {})
                        tool_results.append({"toolResult": {
                            "toolUseId": tu["toolUseId"],
                            "content": [{"json": result}],
                        }})
                    messages.append({"role": "user", "content": tool_results})
                    continue

                # final text answer
                answer = _extract_text(out)
                return self._finalize(answer, beginner_mode)

            # Ran out of rounds; ask for a final grounded summary.
            messages.append({"role": "user", "content": [{"text":
                "Give your final answer now using only the data already retrieved."}]})
            resp = client.converse(
                modelId=config.BEDROCK_MODEL_ID,
                system=[{"text": system_text}],
                messages=messages,
                inferenceConfig={"maxTokens": config.BEDROCK_MAX_TOKENS, "temperature": 0.2},
            )
            answer = _extract_text(resp["output"]["message"])
            return self._finalize(answer, beginner_mode)

        except BedrockUnavailable:
            raise
        except Exception as e:  # noqa: BLE001
            log.warning("Bedrock converse failed: %s", e)
            raise BedrockUnavailable(str(e)) from e

    def _finalize(self, answer: str, beginner_mode: bool) -> dict:
        sources = []
        seen = set()
        is_sample = False
        for ev in self.evidence:
            m = ev["meta"]
            key = (m["source"], m["asOf"])
            is_sample = is_sample or bool(m.get("isSample"))
            if key not in seen:
                seen.add(key)
                sources.append({"source": m["source"], "asOf": m["asOf"],
                                "isSample": m.get("isSample", False), "note": m.get("note")})
        return {
            "answer": answer.strip(),
            "evidence": self.evidence,
            "sources": sources,
            "usedTools": [ev["tool"] for ev in self.evidence],
            "isSample": is_sample,
            "beginnerMode": beginner_mode,
        }


def _extract_text(message: dict) -> str:
    parts = []
    for block in message.get("content", []):
        if "text" in block:
            parts.append(block["text"])
    return "\n".join(parts).strip() or "I don't have enough information to answer that."
