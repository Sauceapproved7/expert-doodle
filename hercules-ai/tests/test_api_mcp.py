from fastapi.testclient import TestClient
from app.main import app

client=TestClient(app)

def test_mcp_initialize():
    r=client.post("/mcp",json={"jsonrpc":"2.0","id":1,"method":"initialize","params":{}})
    assert r.status_code==200
    body=r.json()
    assert body["result"]["serverInfo"]["name"]=="hercules-mcp"

def test_mcp_lists_only_allowlisted_tools():
    r=client.post("/mcp",json={"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}})
    names={x["name"] for x in r.json()["result"]["tools"]}
    assert names=={"hercules.status","hercules.echo"}

def test_mcp_unknown_tool_fails_closed():
    r=client.post("/mcp",json={"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"shell.exec","arguments":{}}})
    assert r.json()["error"]["code"]==-32601
