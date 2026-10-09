"""Manual end-to-end check of the research agent against real Bedrock.

Run from backend/:  python scripts/try_agent.py
Requires AWS credentials with bedrock:InvokeModel on the configured model.
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from investmate.agent import ResearchAgent
from investmate.providers.resilient import ResilientProvider


def main():
    provider = ResilientProvider()
    agent = ResearchAgent(provider)
    out = agent.run(
        question="Explain what happened to RELIANCE and help me understand its "
                 "historical performance over the last 3 months.",
        symbol="RELIANCE",
        period="3M",
        beginner_mode=True,
    )
    report = []
    report.append("=== ANSWER ===")
    report.append(out["answer"])
    report.append("\n=== USED TOOLS === " + str(out["usedTools"]))
    report.append("=== isSample === " + str(out["isSample"]))
    report.append("=== SOURCES === " + json.dumps(out["sources"], indent=2))
    report.append("=== EVIDENCE TOOLS === " + str([e["tool"] for e in out["evidence"]]))
    text = "\n".join(report)
    with open("agent_e2e.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print(text)


if __name__ == "__main__":
    main()
