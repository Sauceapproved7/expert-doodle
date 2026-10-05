from __future__ import annotations

from collections.abc import Mapping, Set
from typing import Any


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
    user_id: str,
    issuer: str,
    audience: str,
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
    if not isinstance(subject, str) or not subject or subject != user_id:
        return False

    client_id = payload.get("client_id")
    return isinstance(client_id, str) and bool(client_id.strip())
