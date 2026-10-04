from pathlib import Path


def test_http_and_mcp_inventory_share_one_contract():
    main=Path("hercules-ai/app/main.py").read_text()
    mcp=Path("hercules-ai/app/mcp_server.py").read_text()
    assert "from .model_inventory import installed_models" in main
    assert "from .model_inventory import installed_models" in mcp
    assert "urllib.request" not in mcp
    assert 'client.get(f"{BASE}/api/tags")' not in main
