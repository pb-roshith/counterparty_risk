"""Create Mistral agents once and reuse their IDs across requests and restarts."""
from __future__ import annotations

import json
import os
from pathlib import Path
from threading import Lock

from mistralai.client import Mistral


_LOCK = Lock()
_IDS: dict[str, str] = {}
_STATE = Path(__file__).resolve().parents[1] / "data" / "mistral_agents.json"


def agent_id(client: Mistral, name: str, instructions: str, model: str, tools: list[dict] | None = None) -> str:
    env_name = "MISTRAL_" + name.upper().replace("-", "_") + "_AGENT_ID"
    if os.getenv(env_name):
        return os.environ[env_name]
    with _LOCK:
        if name in _IDS:
            return _IDS[name]
        saved = json.loads(_STATE.read_text(encoding="utf-8")) if _STATE.exists() else {}
        if name in saved:
            _IDS[name] = saved[name]
            return saved[name]
        agent = client.beta.agents.create(
            model=model, name="Counterparty risk " + name.replace("-", " "),
            description="Summarize supplied counterparty risk data.",
            instructions=instructions,
            tools=tools,
            completion_args={"temperature": 0},
        )
        saved[name] = agent.id
        _STATE.parent.mkdir(parents=True, exist_ok=True)
        temporary = _STATE.with_suffix(".tmp")
        temporary.write_text(json.dumps(saved, indent=2), encoding="utf-8")
        temporary.replace(_STATE)
        _IDS[name] = agent.id
        return agent.id


def response_text(response: object) -> str:
    parts = []
    for output in response.outputs:
        content = getattr(output, "content", None)
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            parts.extend(item.text for item in content if getattr(item, "text", None))
    if not parts:
        raise ValueError("Mistral returned no report text")
    return "\n".join(parts)
