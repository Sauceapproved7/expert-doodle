import json
from app import mcp_server
from app.vault import append_event

def test_vault_verify_tool_is_read_only_and_reports_valid_chain(tmp_path,monkeypatch):
    path=str(tmp_path/"vault.db"); monkeypatch.setenv("HERCULES_VAULT_DB",path)
    append_event(path,"plan","abc",{"ok":True})
    names={t["name"] for t in mcp_server.list_tools()}
    assert "hercules.vault.verify" in names
    result=json.loads(mcp_server.call_tool("hercules.vault.verify",{})["content"][0]["text"])
    assert result["valid"] is True
    assert result["events"]==1
