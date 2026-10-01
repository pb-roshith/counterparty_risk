from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException


def require_write_access(x_api_key: str | None = Header(default=None)) -> str:
    expected = os.getenv("API_WRITE_KEY")
    if not expected or not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=403, detail="Write access is not configured or key is invalid")
    return "api-key-user"


def redact_for_llm(facts: dict) -> dict:
    restricted = ("tax", "account", "email", "ip_address", "device", "personal")
    def clean(value):
        if isinstance(value, dict):
            return {key: clean(item) for key, item in value.items() if not any(token in key.lower() for token in restricted)}
        if isinstance(value, list):
            return [clean(item) for item in value]
        return value
    return clean(facts)
