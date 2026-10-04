from pathlib import Path


def test_public_mcp_requires_owner_bearer_token():
    source = Path("hercules-ai/app/main.py").read_text()
    assert 'HERCULES_MCP_TOKEN' in source
    assert 'Authorization' in source
    assert 'secrets.compare_digest' in source
    assert 'HERCULES_PUBLIC_HOSTED' in source
    assert 'MCP authentication is not configured' in source
    assert 'Bearer' in source
