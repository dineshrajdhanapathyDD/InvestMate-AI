"""Exercise the router across all endpoints and write results to a file."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from investmate.router import Router

r = Router()
lines = []


def call(method, path, query=None, body=None, headers=None):
    status, resp = r.handle(method, path, query or {}, body or {}, headers or {})
    short = json.dumps(resp)
    if len(short) > 400:
        short = short[:400] + "..."
    lines.append(f"{method} {path} -> {status}  {short}")


call("GET", "/api/v1/health")
call("GET", "/api/v1/integrations/nse")
call("GET", "/api/v1/indices")
call("GET", "/api/v1/stocks/search", {"q": "bank"})
call("GET", "/api/v1/stocks/RELIANCE")
call("GET", "/api/v1/stocks/TCS/history", {"period": "6M"})
call("GET", "/api/v1/stocks/bad!symbol")              # invalid -> 400
call("GET", "/api/v1/stocks/TCS/history", {"period": "99Y"})  # invalid period -> 400
call("POST", "/api/v1/research", body={"question": ""})       # empty -> 400
call("PUT", "/api/v1/watchlist", body={"clientId": "test-123", "symbols": ["TCS", "INFY"]})
call("GET", "/api/v1/watchlist", {"clientId": "test-123"})
call("POST", "/api/v1/portfolio/risk", body={"holdings": [
    {"symbol": "TCS", "quantity": 10}, {"symbol": "HDFCBANK", "quantity": 5}]})
call("POST", "/api/v1/portfolio/risk", body={"holdings": []})  # invalid -> 400
call("GET", "/api/v1/does-not-exist")                 # 404

with open("router_results.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("\n".join(lines))
