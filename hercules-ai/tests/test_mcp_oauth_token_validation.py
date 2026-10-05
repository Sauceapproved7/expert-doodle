import importlib.util
from pathlib import Path

MODULE = Path("hercules-ai/app/oauth_validation.py")
SPEC = importlib.util.spec_from_file_location("hercules_oauth_validation", MODULE)
oauth_validation = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(oauth_validation)

validate = oauth_validation.validate_introspection_claims

BASE = {
    "active": True,
    "iss": "https://auth.example.test",
    "aud": ["https://mcp.example.test"],
    "scope": "hercules.read",
    "exp": 2000,
    "nbf": 900,
}


def check(payload):
    return validate(
        payload,
        issuer="https://auth.example.test",
        resource="https://mcp.example.test",
        required_scopes={"hercules.read"},
        now=1000,
    )


def test_valid_introspection_claims_pass():
    assert check(BASE) is True


def test_wrong_issuer_fails_closed():
    assert check({**BASE, "iss": "https://evil.example.test"}) is False


def test_expired_or_missing_exp_fails_closed():
    assert check({**BASE, "exp": 999}) is False
    payload = dict(BASE)
    payload.pop("exp")
    assert check(payload) is False


def test_future_or_malformed_nbf_fails_closed():
    assert check({**BASE, "nbf": 1001}) is False
    assert check({**BASE, "nbf": "1001"}) is False


def test_wrong_audience_fails_closed():
    assert check({**BASE, "aud": ["https://other.example.test"]}) is False


def test_missing_required_scope_fails_closed():
    assert check({**BASE, "scope": "profile"}) is False
