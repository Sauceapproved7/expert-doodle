from pathlib import Path
import importlib.util


MODULE = Path("hercules-ai/app/submission_continuation.py")


def load_module():
    spec = importlib.util.spec_from_file_location("submission_continuation", MODULE)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_submission_controller_advances_safe_automated_work_and_stops_at_external_gates():
    module = load_module()
    plan = module.build_submission_plan(
        {
            "production_commit_verified": True,
            "production_commit_matches_expected": True,
            "oauth_signature_verification_live": True,
            "domain_challenge_configured": False,
            "oauth_client_registration_ready": False,
            "reviewer_oauth_verified": False,
            "positive_cases_proven": False,
            "demo_recording_ready": False,
            "portal_draft_created": False,
        }
    )

    assert plan["status"] == "blocked_external"
    assert plan["safe_actions"] == []
    assert set(plan["external_gates"]) == {
        "openai_domain_challenge",
        "oauth_client_registration",
        "reviewer_oauth_verification",
        "demo_recording",
        "plugin_portal_draft",
        "legal_publication_clearance",
    }
    assert "submit_for_review" not in plan["safe_actions"]


def test_submission_controller_automates_verification_after_external_inputs_arrive():
    module = load_module()
    plan = module.build_submission_plan(
        {
            "production_commit_verified": True,
            "production_commit_matches_expected": True,
            "oauth_signature_verification_live": True,
            "domain_challenge_configured": True,
            "domain_challenge_verified": False,
            "oauth_client_registration_ready": True,
            "reviewer_oauth_verified": True,
            "positive_cases_proven": False,
            "demo_recording_ready": True,
            "portal_draft_created": True,
            "legal_publication_cleared": True,
        }
    )

    assert plan["status"] == "automation_ready"
    assert plan["safe_actions"] == [
        "verify_domain_challenge",
        "run_reviewer_positive_cases",
    ]
    assert plan["external_gates"] == []
    assert plan["owner_only_actions"] == []


def test_submission_controller_never_auto_submits_or_publishes():
    module = load_module()
    plan = module.build_submission_plan(
        {
            "production_commit_verified": True,
            "production_commit_matches_expected": True,
            "oauth_signature_verification_live": True,
            "domain_challenge_configured": True,
            "domain_challenge_verified": True,
            "oauth_client_registration_ready": True,
            "reviewer_oauth_verified": True,
            "positive_cases_proven": True,
            "demo_recording_ready": True,
            "portal_draft_created": True,
            "legal_publication_cleared": True,
        }
    )

    assert plan["status"] == "owner_gate"
    assert plan["safe_actions"] == []
    assert plan["owner_only_actions"] == ["submit_for_review"]
    assert "publish_plugin" not in plan["safe_actions"]


def test_submission_controller_blocks_when_legal_publication_is_not_cleared():
    module = load_module()
    plan = module.build_submission_plan(
        {
            "production_commit_verified": True,
            "production_commit_matches_expected": True,
            "oauth_signature_verification_live": True,
            "domain_challenge_configured": True,
            "domain_challenge_verified": True,
            "oauth_client_registration_ready": True,
            "reviewer_oauth_verified": True,
            "positive_cases_proven": True,
            "demo_recording_ready": True,
            "portal_draft_created": True,
            "legal_publication_cleared": False,
        }
    )

    assert plan["status"] == "blocked_external"
    assert plan["safe_actions"] == []
    assert plan["external_gates"] == ["legal_publication_clearance"]
    assert plan["owner_only_actions"] == []


def test_submission_readiness_snapshot_is_read_only_and_fail_closed():
    module = load_module()
    snapshot = module.build_submission_readiness_snapshot(
        {
            "production_commit_verified": True,
            "production_commit_matches_expected": True,
            "oauth_signature_verification_live": True,
            "domain_challenge_configured": False,
            "domain_challenge_verified": False,
            "oauth_client_registration_ready": False,
            "reviewer_oauth_verified": False,
            "positive_cases_proven": False,
            "demo_recording_ready": False,
            "portal_draft_created": False,
            "legal_publication_cleared": False,
        }
    )

    assert snapshot["status"] == "blocked_external"
    assert snapshot["read_only"] is True
    assert snapshot["submission_performed"] is False
    assert snapshot["publication_performed"] is False
    assert "legal_publication_clearance" in snapshot["external_gates"]
    assert "openai_domain_challenge" in snapshot["external_gates"]


def test_main_exposes_read_only_submission_readiness_route():
    source = Path("hercules-ai/app/main.py").read_text()
    assert '@app.get("/v1/submission/readiness")' in source
    assert "build_submission_readiness_snapshot" in source


def test_submission_controller_blocks_when_production_commit_does_not_match_expected():
    module = load_module()
    plan = module.build_submission_plan(
        {
            "production_commit_verified": True,
            "production_commit_matches_expected": False,
            "oauth_signature_verification_live": True,
            "domain_challenge_configured": True,
            "domain_challenge_verified": True,
            "oauth_client_registration_ready": True,
            "reviewer_oauth_verified": True,
            "positive_cases_proven": True,
            "demo_recording_ready": True,
            "portal_draft_created": True,
            "legal_publication_cleared": True,
        }
    )

    assert plan["status"] == "blocked_internal"
    assert plan["safe_actions"] == []
    assert plan["internal_gates"] == ["production_commit_drift"]
    assert plan["owner_only_actions"] == []
