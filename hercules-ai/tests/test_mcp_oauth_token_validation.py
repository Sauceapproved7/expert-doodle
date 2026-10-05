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


def test_supabase_claims_require_exact_identity_and_time_binding():
    validate_supabase = oauth_validation.validate_supabase_claims
    payload = {
        "iss": "https://project.supabase.co/auth/v1",
        "aud": "authenticated",
        "sub": "user-1",
        "client_id": "client-1",
        "exp": 2000,
    }
    assert validate_supabase(
        payload,
        user_id="user-1",
        issuer="https://project.supabase.co/auth/v1",
        audience="authenticated",
        now=1000,
    ) is True
    assert validate_supabase({**payload, "iss": "https://evil.test"}, user_id="user-1", issuer="https://project.supabase.co/auth/v1", audience="authenticated", now=1000) is False
    assert validate_supabase({**payload, "aud": "other"}, user_id="user-1", issuer="https://project.supabase.co/auth/v1", audience="authenticated", now=1000) is False
    assert validate_supabase({**payload, "sub": "user-2"}, user_id="user-1", issuer="https://project.supabase.co/auth/v1", audience="authenticated", now=1000) is False
    assert validate_supabase({**payload, "client_id": ""}, user_id="user-1", issuer="https://project.supabase.co/auth/v1", audience="authenticated", now=1000) is False
    assert validate_supabase({**payload, "exp": 999}, user_id="user-1", issuer="https://project.supabase.co/auth/v1", audience="authenticated", now=1000) is False


def test_supabase_claims_require_openid_email_scope_and_verified_email():
    validate_supabase = oauth_validation.validate_supabase_claims
    payload = {
        "iss": "https://project.supabase.co/auth/v1",
        "aud": "authenticated",
        "sub": "user-1",
        "client_id": "client-1",
        "scope": "openid email",
        "exp": 2000,
    }
    kwargs = {
        "user_subject": "user-1",
        "email_verified": True,
        "issuer": "https://project.supabase.co/auth/v1",
        "audience": "authenticated",
        "required_scopes": {"openid", "email"},
        "now": 1000,
    }
    assert validate_supabase(payload, **kwargs) is True
    assert validate_supabase(payload, **{**kwargs, "email_verified": False}) is False
    assert validate_supabase({**payload, "scope": "email"}, **kwargs) is False
    assert validate_supabase({**payload, "scope": "openid"}, **kwargs) is False
    assert validate_supabase(payload, **{**kwargs, "user_subject": "user-2"}) is False
