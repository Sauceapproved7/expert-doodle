from __future__ import annotations

from collections.abc import Mapping, Set
from typing import Any

import jwt


def validate_introspection_claims(
    payload: Mapping[str, Any],
    *,
    issuer: str,
    resource: str,
    required_scopes: Set[str],
    now: float,
) -> bool:
    if payload.get("active") is not True:
        return False
    if payload.get("iss") != issuer:
        return False

    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or isinstance(exp, bool) or exp <= now:
        return False

    nbf = payload.get("nbf")
    if nbf is not None and (
        not isinstance(nbf, (int, float)) or isinstance(nbf, bool) or nbf > now
    ):
        return False

    audience = payload.get("aud")
    audiences = {audience} if isinstance(audience, str) else set(audience or [])
    if resource not in audiences:
        return False

    scopes = set(str(payload.get("scope", "")).split())
    return required_scopes.issubset(scopes)


def validate_supabase_claims(
    payload: Mapping[str, Any],
    *,
    user_subject: str,
    email_verified: bool,
    issuer: str,
    audience: str,
    required_scopes: Set[str],
    now: float,
) -> bool:
    if payload.get("iss") != issuer:
        return False

    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or isinstance(exp, bool) or exp <= now:
        return False

    nbf = payload.get("nbf")
    if nbf is not None and (
        not isinstance(nbf, (int, float)) or isinstance(nbf, bool) or nbf > now
    ):
        return False

    token_audience = payload.get("aud")
    audiences = (
        {token_audience}
        if isinstance(token_audience, str)
        else set(token_audience or [])
    )
    if audience not in audiences:
        return False

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject or subject != user_subject:
        return False

    client_id = payload.get("client_id")
    if not isinstance(client_id, str) or not client_id.strip():
        return False

    if email_verified is not True:
        return False

    scopes = set(str(payload.get("scope", "")).split())
    return required_scopes.issubset(scopes)


def verify_supabase_jwt_signature(
    token: str,
    jwks: Mapping[str, Any],
    *,
    issuer: str,
    audience: str,
    now: float,
) -> dict[str, Any] | None:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        return None
    kid = header.get("kid")
    alg = header.get("alg")
    if not isinstance(kid, str) or not kid or alg not in {"RS256", "ES256"}:
        return None
    keys = jwks.get("keys")
    if not isinstance(keys, list):
        return None
    candidates = [
        key for key in keys
        if isinstance(key, Mapping)
        and key.get("kid") == kid
        and key.get("alg") == alg
        and ((key.get("kty") == "RSA" and alg == "RS256") or (key.get("kty") == "EC" and alg == "ES256"))
    ]
    if len(candidates) != 1:
        return None
    try:
        public_key = jwt.PyJWK.from_dict(dict(candidates[0])).key
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            issuer=issuer,
            audience=audience,
            options={"verify_exp": False, "verify_nbf": False},
        )
    except (jwt.PyJWTError, ValueError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or isinstance(exp, bool) or exp <= now:
        return None
    nbf = payload.get("nbf")
    if nbf is not None and (not isinstance(nbf, (int, float)) or isinstance(nbf, bool) or nbf > now):
        return None
    return payload


def jwks_has_asymmetric_signing_key(payload: Mapping[str, Any]) -> bool:
    keys = payload.get("keys")
    if not isinstance(keys, list):
        return False
    for key in keys:
        if not isinstance(key, Mapping):
            continue
        kty = key.get("kty")
        alg = key.get("alg")
        if (kty == "RSA" and alg == "RS256") or (kty == "EC" and alg == "ES256"):
            return True
    return False
