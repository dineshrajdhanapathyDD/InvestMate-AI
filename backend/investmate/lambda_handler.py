"""AWS Lambda entry point for API Gateway (REST, proxy integration)."""
from __future__ import annotations

import json
import logging

from .config import config
from .router import Router

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger("investmate.lambda")

_router = Router()

_CORS = {
    "Access-Control-Allow-Origin": config.CORS_ALLOW_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,X-Client-Id",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
}


def _response(status: int, body: dict):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **_CORS},
        "body": json.dumps(body),
    }


def handler(event, context):  # noqa: ARG001
    method = (event.get("httpMethod")
              or event.get("requestContext", {}).get("http", {}).get("method", "GET"))
    path = event.get("path") or event.get("rawPath") or "/"
    query = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": _CORS, "body": ""}

    raw = event.get("body") or ""
    body = {}
    if raw:
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            return _response(400, {"ok": False, "error": {
                "code": "BAD_REQUEST", "message": "Request body must be valid JSON."}})

    status, resp_body = _router.handle(method, path, query, body, headers)
    return _response(status, resp_body)
