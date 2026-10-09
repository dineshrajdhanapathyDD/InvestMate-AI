"""Local dev server for InvestMate AI, sharing the same Router as Lambda.

Usage:
    cd backend
    python local_server.py            # serves on http://localhost:8000

Env toggles (optional):
    BEDROCK_ENABLED=false             # skip real model calls (returns 503 on /research)
    NSE_MCP_ENABLED=true              # attempt live NSE MCP (will fall back w/ note)
    DYNAMODB_ENABLED=false            # use in-memory watchlist/prefs (default local)
"""
from __future__ import annotations

import json
import os

# Default to in-memory persistence locally unless explicitly enabled.
os.environ.setdefault("DYNAMODB_ENABLED", "false")

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from investmate.router import Router

router = Router()

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Client-Id",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quieter logs
        pass

    def _send(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def _handle(self, method):
        parsed = urlparse(self.path)
        query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else ""
        body = {}
        if raw:
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                return self._send(400, {"ok": False, "error": {
                    "code": "BAD_REQUEST", "message": "Body must be valid JSON."}})
        headers = {k: v for k, v in self.headers.items()}
        status, resp = router.handle(method, parsed.path, query, body, headers)
        self._send(status, resp)

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def do_PUT(self):
        self._handle("PUT")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"InvestMate AI local API on http://localhost:{port}  (prefix /api/v1)")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
