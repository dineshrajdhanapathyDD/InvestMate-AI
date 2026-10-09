"""Agent tests with a fake Bedrock client. No real network calls."""
import pytest

from investmate.agent import BedrockUnavailable, ResearchAgent, TOOL_SPECS
from investmate.providers.resilient import ResilientProvider


class FakeBedrock:
    """Scripts a sequence of converse() responses."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        return self._responses.pop(0)


def _tool_use_response(tool, args, tool_use_id="t1"):
    return {
        "stopReason": "tool_use",
        "output": {"message": {"role": "assistant", "content": [
            {"text": "<thinking>need data</thinking>"},
            {"toolUse": {"toolUseId": tool_use_id, "name": tool, "input": args}},
        ]}},
    }


def _final_response(text):
    return {
        "stopReason": "end_turn",
        "output": {"message": {"role": "assistant", "content": [{"text": text}]}},
    }


def test_agent_runs_tool_then_answers_grounded():
    fake = FakeBedrock([
        _tool_use_response("get_history", {"symbol": "RELIANCE", "period": "3M"}),
        _final_response("**What the data shows** RELIANCE moved over the period."),
    ])
    agent = ResearchAgent(ResilientProvider(), bedrock_client=fake)
    out = agent.run("Explain RELIANCE", "RELIANCE", "3M", beginner_mode=True)

    assert out["usedTools"] == ["get_history"]
    assert out["evidence"][0]["tool"] == "get_history"
    # The executed tool returned real (sample) data with metrics attached.
    assert "metrics" in out["evidence"][0]["result"]
    assert out["isSample"] is True
    assert out["sources"] and out["sources"][0]["isSample"] is True


def test_agent_passes_valid_params_to_tools():
    fake = FakeBedrock([
        _tool_use_response("get_quote", {"symbol": "TCS"}),
        _final_response("TCS quote retrieved."),
    ])
    agent = ResearchAgent(ResilientProvider(), bedrock_client=fake)
    out = agent.run("TCS price?", "TCS", None, beginner_mode=False)
    ev = out["evidence"][0]
    assert ev["args"] == {"symbol": "TCS"}
    assert ev["result"]["symbol"] == "TCS"


def test_agent_raises_instead_of_fabricating_on_bedrock_error():
    class Boom:
        def converse(self, **kwargs):
            raise RuntimeError("Bedrock throttled")

    agent = ResearchAgent(ResilientProvider(), bedrock_client=Boom())
    with pytest.raises(BedrockUnavailable):
        agent.run("Explain TCS", "TCS", "3M", beginner_mode=True)


def test_agent_handles_invalid_symbol_tool_gracefully():
    # Model asks for a nonsense symbol; provider still returns labelled sample
    # data (never crashes), and the agent completes without fabricating.
    fake = FakeBedrock([
        _tool_use_response("get_quote", {"symbol": "NOTREAL"}),
        _final_response("Here is what I found for NOTREAL."),
    ])
    agent = ResearchAgent(ResilientProvider(), bedrock_client=fake)
    out = agent.run("Explain NOTREAL", "NOTREAL", None, beginner_mode=False)
    assert out["evidence"][0]["result"]["symbol"] == "NOTREAL"
    assert out["isSample"] is True


def test_tool_specs_declare_required_params():
    names = {t["toolSpec"]["name"] for t in TOOL_SPECS}
    assert {"search_symbol", "get_quote", "get_history", "get_index_overview"} <= names
    for t in TOOL_SPECS:
        spec = t["toolSpec"]
        assert "inputSchema" in spec and "json" in spec["inputSchema"]
