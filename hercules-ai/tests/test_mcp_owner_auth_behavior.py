import asyncio

import app.main as main


def run_mcp(monkeypatch, *, token, public_hosted, authorization):
    monkeypatch.setattr(main, "MCP_TOKEN", token)
    monkeypatch.setattr(main, "PUBLIC_HOSTED", public_hosted)
    req = main.RpcRequest(jsonrpc="2.0", id=1, method="tools/list", params={})
    return asyncio.run(main.mcp(req, authorization=authorization))


def test_public_host_without_configured_token_fails_closed(monkeypatch):
    try:
        run_mcp(monkeypatch, token="", public_hosted=True, authorization=None)
    except main.HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "MCP authentication is not configured"
    else:
        raise AssertionError("public hosted MCP must fail closed without a token")


def test_missing_owner_token_is_rejected(monkeypatch):
    try:
        run_mcp(monkeypatch, token="owner-secret", public_hosted=True, authorization=None)
    except main.HTTPException as exc:
        assert exc.status_code == 401
        assert exc.headers == {"WWW-Authenticate": "Bearer"}
    else:
        raise AssertionError("missing bearer token must be rejected")


def test_wrong_owner_token_is_rejected(monkeypatch):
    try:
        run_mcp(monkeypatch, token="owner-secret", public_hosted=True, authorization="Bearer wrong")
    except main.HTTPException as exc:
        assert exc.status_code == 401
    else:
        raise AssertionError("wrong bearer token must be rejected")


def test_correct_owner_token_reaches_safe_dispatch(monkeypatch):
    monkeypatch.setattr(main, "dispatch", lambda method, params: {"method": method, "ok": True})
    out = run_mcp(monkeypatch, token="owner-secret", public_hosted=True, authorization="Bearer owner-secret")
    assert out == {"jsonrpc": "2.0", "id": 1, "result": {"method": "tools/list", "ok": True}}
