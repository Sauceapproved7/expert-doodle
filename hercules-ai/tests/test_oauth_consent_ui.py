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
