import json
from app import mcp_server

def test_vault_tools_are_read_only_and_listed():
    names={t["name"] for t in mcp_server.list_tools()}
    assert "hercules.vault.status" in names
    assert "hercules.vault.events" in names
    assert not any(name.startswith("hercules.vault.") and any(word in name for word in ("write","append","delete","update")) for name in names)

def test_vault_status_and_events(tmp_path,monkeypatch):
    from app.vault import append_event
    path=str(tmp_path/"vault.db")
    monkeypatch.setenv("HERCULES_VAULT_DB",path)
    append_event(path,"test","abc",{"ok":True})
    status=json.loads(mcp_server.call_tool("hercules.vault.status",{})["content"][0]["text"])
    events=json.loads(mcp_server.call_tool("hercules.vault.events",{"limit":10})["content"][0]["text"])
    assert status["append_only"] is True
    assert status["event_count"]==1
    assert events[0]["action"]=="test"
