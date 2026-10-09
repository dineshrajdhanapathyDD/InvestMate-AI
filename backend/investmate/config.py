"""Runtime configuration, sourced from environment variables.

Nothing secret lives here. MCP URLs are operational config, not secrets, but we
still never return them unsanitized to the browser.
"""
from __future__ import annotations

import os


def _bool(name: str, default: bool) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


class Config:
    # --- Bedrock ---
    # Default region is ap-south-1 (Mumbai) for low latency to Indian users.
    # In ap-south-1, Nova requires an inference profile id (apac.* prefix); the
    # raw model id only works on-demand in us-east-1. Both are configurable.
    BEDROCK_MODEL_ID: str = os.environ.get("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")
    BEDROCK_REGION: str = os.environ.get("BEDROCK_REGION", os.environ.get("AWS_REGION", "ap-south-1"))
    BEDROCK_MAX_TOKENS: int = int(os.environ.get("BEDROCK_MAX_TOKENS", "900"))
    BEDROCK_ENABLED: bool = _bool("BEDROCK_ENABLED", True)

    # --- NSE MCP ---
    NSE_MCP_ENABLED: bool = _bool("NSE_MCP_ENABLED", False)
    NSE_MCP_CM_URL: str = os.environ.get("NSE_MCP_CM_URL", "https://mcp.nseindia.in/cmmkt/mcp")
    NSE_MCP_BHAV_URL: str = os.environ.get("NSE_MCP_BHAV_URL", "https://mcp.nseindia.in/bhavcopy/cm/mcp")
    NSE_MCP_CONNECT_TIMEOUT: float = float(os.environ.get("NSE_MCP_CONNECT_TIMEOUT", "6"))
    NSE_MCP_READ_TIMEOUT: float = float(os.environ.get("NSE_MCP_READ_TIMEOUT", "12"))
    NSE_MCP_RETRIES: int = int(os.environ.get("NSE_MCP_RETRIES", "1"))

    # --- Persistence ---
    TABLE_NAME: str = os.environ.get("TABLE_NAME", "investmate")
    DYNAMODB_ENABLED: bool = _bool("DYNAMODB_ENABLED", True)

    # --- CORS ---
    CORS_ALLOW_ORIGIN: str = os.environ.get("CORS_ALLOW_ORIGIN", "*")

    @staticmethod
    def sanitized_mcp_hosts() -> dict:
        """Host-only view of the MCP endpoints for the integrations endpoint."""
        from urllib.parse import urlparse

        def host(u: str) -> str:
            try:
                return urlparse(u).netloc or u
            except Exception:
                return "unknown"

        return {
            "cm-market": host(Config.NSE_MCP_CM_URL),
            "nse-bhavcopy": host(Config.NSE_MCP_BHAV_URL),
        }


config = Config()
