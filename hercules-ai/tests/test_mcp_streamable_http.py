from pathlib import Path


def test_mcp_runtime_uses_official_streamable_http_transport():
    requirements = Path("hercules-ai/requirements.txt").read_text()
    source = Path("hercules-ai/app/main.py").read_text()

    assert "mcp==" in requirements
    assert "StreamableHTTPSessionManager" in source
    assert 'app.mount("/mcp"' in source


def test_legacy_hand_rolled_mcp_route_is_removed():
    source = Path("hercules-ai/app/main.py").read_text()

    assert '@app.post("/mcp")' not in source
    assert "RpcRequest" not in source
