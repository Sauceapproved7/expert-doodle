from app.mcp_server import dispatch

def test_initialize():
    r=dispatch("initialize",{})
    assert r["serverInfo"]["name"]=="hercules-mcp"

def test_tools_are_allowlisted():
    names={x["name"] for x in dispatch("tools/list",{})["tools"]}
    assert names=={"hercules.status","hercules.echo"}

def test_echo():
    r=dispatch("tools/call",{"name":"hercules.echo","arguments":{"text":"Hercules"}})
    assert r["content"][0]["text"]=="Hercules"

def test_unknown_tool_fails_closed():
    try:
        dispatch("tools/call",{"name":"shell.exec","arguments":{}})
        assert False
    except KeyError:
        pass
