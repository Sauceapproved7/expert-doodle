from pathlib import Path


def test_oauth_consent_ui_contract():
    page = Path("hercules-ai/ui/oauth/consent.html").read_text()
    assert "authorization_id" in page
    assert "getAuthorizationDetails" in page
    assert "approveAuthorization" in page
    assert "denyAuthorization" in page
    assert "requested-scopes" in page
    assert "requesting-client" in page
    assert ">Approve<" in page
    assert ">Deny<" in page
    assert "window.location.replace" in page


def test_oauth_consent_ui_fails_closed_without_authorization_id():
    page = Path("hercules-ai/ui/oauth/consent.html").read_text()
    assert "if (!authorizationId)" in page
    assert "Invalid authorization request" in page


def test_oauth_consent_route_is_served_explicitly():
    source = Path("hercules-ai/app/main.py").read_text()
    assert '@app.get("/oauth/consent")' in source
    assert "content=render_oauth_consent(" in source


def test_consent_has_one_get_route():
    import app.main as main
    routes = [r for r in main.app.routes if getattr(r, "path", None) == "/oauth/consent" and "GET" in getattr(r, "methods", set())]
    assert len(routes) == 1


def test_consent_missing_configuration_fails_closed(monkeypatch):
    import asyncio
    import httpx
    import app.main as main
    monkeypatch.setattr(main, "MCP_OAUTH_MODE", "")
    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="https://hercules.example") as client:
            return await client.get("/oauth/consent")
    response = asyncio.run(request())
    assert response.status_code == 503
    assert response.json() == {"detail": "oauth_consent_not_configured"}


def test_configured_consent_uses_runtime_config_and_security_headers(monkeypatch):
    import asyncio
    import httpx
    import app.main as main
    monkeypatch.setattr(main, "MCP_OAUTH_MODE", "supabase")
    monkeypatch.setattr(main, "MCP_OAUTH_SUPABASE_ORIGIN", "https://configured.example")
    monkeypatch.setattr(main, "MCP_OAUTH_PUBLISHABLE_KEY", "public-test-key")
    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="https://hercules.example") as client:
            return await client.get("/oauth/consent")
    response = asyncio.run(request())
    assert response.status_code == 200
    assert "https://configured.example" in response.text
    assert "public-test-key" in response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert response.headers["referrer-policy"] == "no-referrer"
