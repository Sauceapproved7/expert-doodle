from pathlib import Path


def test_public_mcp_requires_owner_bearer_token():
    source = Path("hercules-ai/app/main.py").read_text()
    assert 'HERCULES_MCP_TOKEN' in source
    assert 'Authorization' in source
    assert 'secrets.compare_digest' in source
    assert 'HERCULES_PUBLIC_HOSTED' in source
    assert 'MCP authentication is not configured' in source
    assert 'Bearer' in source


def test_mcp_publishes_oauth_protected_resource_metadata():
    source = Path("hercules-ai/app/main.py").read_text()
    assert 'HERCULES_MCP_RESOURCE' in source
    assert 'HERCULES_MCP_AUTHORIZATION_SERVER' in source
    assert '/.well-known/oauth-protected-resource' in source
    assert '"resource": MCP_RESOURCE' in source
    assert '"authorization_servers": [MCP_AUTHORIZATION_SERVER]' in source


def test_mcp_unauthorized_challenge_points_to_resource_metadata():
    source = Path("hercules-ai/app/main.py").read_text()
    assert 'resource_metadata=' in source
    assert '/.well-known/oauth-protected-resource' in source
    assert 'WWW-Authenticate' in source
