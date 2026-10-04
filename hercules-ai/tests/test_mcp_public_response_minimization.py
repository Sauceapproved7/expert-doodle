import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path("hercules-ai").resolve()))

from app import mcp_server


def _payload(name, arguments=None):
    result = mcp_server.call_tool(name, arguments or {})
    return json.loads(result["content"][0]["text"])


def test_public_status_omits_runtime_diagnostics_and_timestamps():
    payload = _payload("hercules.command.status")

    assert payload == {
        "ok": True,
        "service": "hercules-mcp",
        "mutation_authority": False,
    }


def test_public_mission_omits_internal_plan_identifier(monkeypatch):
    monkeypatch.setattr(
        mcp_server,
        "mission_plan",
        lambda goal: {
            "id": "internal-plan-id",
            "goal": goal,
            "stages": [{"name": "plan", "status": "pending"}],
            "mutation_requires_authorization": True,
        },
    )

    payload = _payload("hercules.command.mission", {"goal": "review readiness"})

    assert payload == {
        "goal": "review readiness",
        "stages": [{"name": "plan", "status": "pending"}],
        "mutation_requires_authorization": True,
    }


def test_public_vault_returns_summary_not_internal_event_records(monkeypatch):
    events = [
        {
            "id": "internal-event-id",
            "created_at": 1234567890,
            "action": "verified",
            "commit": "internal-commit",
            "rollback_ref": "internal-rollback",
            "details": {"private": "detail"},
            "prev_hash": "previous-hash",
            "event_hash": "event-hash",
        }
    ]
    monkeypatch.setattr(mcp_server, "list_events", lambda path, limit=100: events)

    payload = _payload("hercules.command.vault", {"limit": 1})

    assert payload == {
        "append_only": True,
        "mutation_authority": False,
        "event_count": 1,
        "recent_actions": ["verified"],
    }


def test_public_model_inventory_omits_backend_timestamps(monkeypatch):
    body = json.dumps(
        {"models": [{"name": "hercules-local", "size": 42, "modified_at": "private-time"}]}
    ).encode()
    monkeypatch.setattr(
        mcp_server.urllib.request,
        "urlopen",
        lambda *args, **kwargs: io.BytesIO(body),
    )

    payload = _payload("hercules.command.models")

    assert payload == {
        "installed": [{"name": "hercules-local", "size": 42}],
        "count": 1,
        "mutation_authority": False,
    }


def test_public_verification_omits_hashes_and_internal_event_ids(monkeypatch):
    monkeypatch.setattr(
        mcp_server,
        "verify_chain",
        lambda path: {
            "valid": False,
            "events": 4,
            "failed_event_id": "internal-event-id",
            "head_hash": "internal-hash",
        },
    )

    payload = _payload("hercules.command.verify")

    assert payload == {"valid": False, "events": 4}
