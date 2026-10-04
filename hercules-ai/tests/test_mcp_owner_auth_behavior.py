import asyncio

import httpx

import app.main as main


async def request_mcp(monkeypatch, *, token, public_hosted, authorization=None, public_validator=None):
    monkeypatch.setattr(main, "MCP_TOKEN", token)
    monkeypatch.setattr(main, "PUBLIC_HOSTED", public_hosted)
    if public_validator is not None:
        monkeypatch.setattr(main, "validate_public_mcp_token", public_validator)

    headers = {}
    if authorization is not None:
        headers["Authorization"] = authorization

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="https://hercules.example") as client:
        return await client.post(
            "/mcp",
            headers=headers,
            json={"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}},
        )


def test_public_host_without_configured_owner_token_fails_closed(monkeypatch):
    response = asyncio.run(
        request_mcp(monkeypatch, token="", public_hosted=True)
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "MCP authentication is not configured"}


def test_missing_bearer_token_is_rejected_with_resource_metadata(monkeypatch):
    response = asyncio.run(
        request_mcp(monkeypatch, token="owner-secret", public_hosted=True)
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
    challenge = response.headers["WWW-Authenticate"]
    assert challenge.startswith("Bearer resource_metadata=")
    assert "/.well-known/oauth-protected-resource" in challenge


def test_wrong_owner_token_is_rejected_when_public_oauth_rejects(monkeypatch):
    async def reject_public(_token):
        return False

    response = asyncio.run(
        request_mcp(
            monkeypatch,
            token="owner-secret",
            public_hosted=True,
            authorization="Bearer wrong",
            public_validator=reject_public,
        )
    )
    assert response.status_code == 401


def test_correct_owner_token_reaches_streamable_http_transport(monkeypatch):
    response = asyncio.run(
        request_mcp(
            monkeypatch,
            token="owner-secret",
            public_hosted=True,
            authorization="Bearer owner-secret",
        )
    )
    assert response.status_code != 401
    assert response.status_code != 503


def test_valid_public_oauth_token_reaches_streamable_http_transport(monkeypatch):
    async def accept_public(token):
        return token == "community-token"

    response = asyncio.run(
        request_mcp(
            monkeypatch,
            token="owner-secret",
            public_hosted=True,
            authorization="Bearer community-token",
            public_validator=accept_public,
        )
    )
    assert response.status_code != 401
    assert response.status_code != 503
