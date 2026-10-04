from pathlib import Path


def test_mcp_runtime_uses_official_streamable_http_transport():
    requirements = Path("hercules-ai/requirements.txt").read_text()
    source = Path("hercules-ai/app/main.py").read_text()
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()

    assert "mcp==2.3.0" in requirements
    assert "MCPServer" in runtime
    assert "streamable_http_app" in source
    assert 'app.mount("/mcp"' in source


def test_legacy_hand_rolled_mcp_route_is_removed():
    source = Path("hercules-ai/app/main.py").read_text()

    assert '@app.post("/mcp")' not in source
    assert "RpcRequest" not in source


def test_transport_security_remains_fail_closed_for_public_hosts():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()

    assert "HERCULES_MCP_ALLOWED_HOSTS" in runtime
    assert "TransportSecuritySettings" in runtime
    assert "enable_dns_rebinding_protection=True" in runtime
