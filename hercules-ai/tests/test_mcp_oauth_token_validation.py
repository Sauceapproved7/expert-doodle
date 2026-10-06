import base64
import importlib.util
import json
from pathlib import Path

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

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
    payload["scope"] = "openid email"
    kwargs = {
        "user_subject": "user-1",
        "email_verified": True,
        "issuer": "https://project.supabase.co/auth/v1",
        "audience": "authenticated",
        "required_scopes": {"openid", "email"},
        "now": 1000,
    }
    assert validate_supabase(payload, **kwargs) is True
    assert validate_supabase({**payload, "iss": "https://evil.test"}, **kwargs) is False
    assert validate_supabase({**payload, "aud": "other"}, **kwargs) is False
    assert validate_supabase({**payload, "sub": "user-2"}, **kwargs) is False
    assert validate_supabase({**payload, "client_id": ""}, **kwargs) is False
    assert validate_supabase({**payload, "exp": 999}, **kwargs) is False


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


def test_supabase_jwt_signature_verification_rejects_tampered_payload():
    verify = oauth_validation.verify_supabase_jwt_signature
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    jwk.update({"kid": "rsa-1", "alg": "RS256", "use": "sig"})
    claims = {
        "iss": "https://project.supabase.co/auth/v1",
        "aud": "authenticated",
        "sub": "user-1",
        "client_id": "client-1",
        "scope": "openid email",
        "exp": 2000,
        "nbf": 900,
    }
    token = jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "rsa-1"})
    assert verify(token, {"keys": [jwk]}, issuer=claims["iss"], audience=claims["aud"], now=1000) == claims

    header, payload, signature = token.split(".")
    tampered = {**claims, "sub": "attacker"}
    encoded = base64.urlsafe_b64encode(json.dumps(tampered, separators=(",", ":")).encode()).rstrip(b"=").decode()
    assert verify(".".join((header, encoded, signature)), {"keys": [jwk]}, issuer=claims["iss"], audience=claims["aud"], now=1000) is None


def test_jwks_requires_asymmetric_openid_signing_key():
    ready = oauth_validation.jwks_has_asymmetric_signing_key

    assert ready({"keys": [{"kty": "RSA", "alg": "RS256", "kid": "rsa-1"}]}) is True
    assert ready({"keys": [{"kty": "EC", "alg": "ES256", "kid": "ec-1"}]}) is True
    assert ready({"keys": [{"kty": "oct", "alg": "HS256", "kid": "legacy"}]}) is False
    assert ready({"keys": []}) is False
    assert ready({}) is False


def test_supabase_request_path_keeps_userinfo_and_jwks_inside_client_context():
    source = Path("hercules-ai/app/main.py").read_text()
    start = source.index("async def validate_supabase_mcp_token")
    end = source.index("async def validate_public_mcp_token", start)
    function_source = source[start:end]

    context_start = function_source.index("async with httpx.AsyncClient")
    context_end = function_source.index("    except (httpx.HTTPError,ValueError):")
    client_context = function_source[context_start:context_end]

    assert "MCP_OAUTH_USER_PATH" in client_context
    jwks_line = next(line for line in client_context.splitlines() if '"/auth/v1/.well-known/jwks.json"' in line)
    assert jwks_line.startswith("            MCP_OAUTH_SUPABASE_ORIGIN")
    assert "verify_supabase_jwt_signature(" in function_source


def test_supabase_request_path_rejects_when_signature_verifier_rejects():
    source = Path("hercules-ai/app/main.py").read_text()
    start = source.index("async def validate_supabase_mcp_token")
    end = source.index("async def validate_public_mcp_token", start)
    function_source = source[start:end]

    assert "payload=verify_supabase_jwt_signature(" in function_source
    assert "if payload is None or not isinstance(user,dict):" in function_source
    assert function_source.index("payload=verify_supabase_jwt_signature(") < function_source.index("return validate_supabase_claims(")
