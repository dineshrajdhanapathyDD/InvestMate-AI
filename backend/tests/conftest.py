import os
import sys

# Ensure the backend package root is importable and external services are off.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DYNAMODB_ENABLED", "false")
os.environ.setdefault("NSE_MCP_ENABLED", "false")
os.environ.setdefault("BEDROCK_ENABLED", "true")
os.environ.setdefault("AWS_REGION", "ap-south-1")
