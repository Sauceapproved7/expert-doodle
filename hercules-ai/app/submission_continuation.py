"""Fail-closed continuation planning for Hercules plugin submission.

This module never performs provider or owner actions. It converts verified
readiness evidence into the next safe automation steps and explicit gates.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


_EXTERNAL_REQUIREMENTS = (
    ("domain_challenge_configured", "openai_domain_challenge"),
    ("oauth_client_registration_ready", "oauth_client_registration"),
    ("reviewer_oauth_verified", "reviewer_oauth_verification"),
    ("demo_recording_ready", "demo_recording"),
    ("portal_draft_created", "plugin_portal_draft"),
)


def build_submission_plan(evidence: Mapping[str, Any]) -> dict[str, Any]:
    """Return deterministic next actions from verified submission evidence."""

    external_gates = [
        gate
        for field, gate in _EXTERNAL_REQUIREMENTS
        if not bool(evidence.get(field))
    ]

    safe_actions: list[str] = []
    owner_only_actions: list[str] = []

    if not external_gates:
        if not bool(evidence.get("domain_challenge_verified")):
            safe_actions.append("verify_domain_challenge")
        if not bool(evidence.get("positive_cases_proven")):
            safe_actions.append("run_reviewer_positive_cases")

    if external_gates:
        status = "blocked_external"
    elif safe_actions:
        status = "automation_ready"
    elif (
        bool(evidence.get("production_commit_verified"))
        and bool(evidence.get("oauth_signature_verification_live"))
    ):
        status = "owner_gate"
        owner_only_actions.append("submit_for_review")
    else:
        status = "blocked_internal"

    return {
        "status": status,
        "safe_actions": safe_actions,
        "external_gates": external_gates,
        "owner_only_actions": owner_only_actions,
    }
