from pathlib import Path

MAIN = Path("hercules-ai/app/main.py").read_text()


def test_openai_domain_challenge_is_env_driven_and_plain_text():
    assert "OPENAI_APPS_CHALLENGE" in MAIN
    assert "/.well-known/openai-apps-challenge" in MAIN
    assert "text/plain" in MAIN


def test_domain_challenge_fails_closed_when_unconfigured():
    assert "OPENAI_APPS_CHALLENGE" in MAIN
    assert "HTTPException(404" in MAIN
