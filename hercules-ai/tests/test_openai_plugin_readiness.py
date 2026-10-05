import json
from pathlib import Path

MAIN = Path("hercules-ai/app/main.py").read_text()


def test_openai_domain_challenge_is_env_driven_and_plain_text():
    assert "OPENAI_APPS_CHALLENGE" in MAIN
    assert "/.well-known/openai-apps-challenge" in MAIN
    assert "text/plain" in MAIN


def test_domain_challenge_fails_closed_when_unconfigured():
    assert "OPENAI_APPS_CHALLENGE" in MAIN
    assert "HTTPException(404" in MAIN


def test_portable_plugin_declares_remote_mcp_at_package_root():
    root_mcp = Path("mcp.json")
    assert root_mcp.is_file(), "portable plugin requires root mcp.json"
    config = root_mcp.read_text()
    assert '"type": "streamable-http"' in config
    assert '"url": "https://hercules-mcp.onrender.com/mcp"' in config


def test_submission_metadata_has_owned_icons_and_complete_review_cases():
    import json

    manifest = json.loads(Path("plugin.json").read_text())
    openai = manifest["extensions"]["com.openai"]
    interface = openai["interface"]

    assert interface["logo"] == "./assets/hercules-plugin.svg"
    assert interface["composerIcon"] == "./assets/hercules-plugin.svg"
    assert Path("assets/hercules-plugin.svg").is_file()

    cases = openai["review"]["test_cases"]
    assert len(cases["positive"]) == 5
    assert len(cases["negative"]) == 3

    allowed_tools = {
        "hercules.get_status",
        "hercules.plan_mission",
        "hercules.get_vault_summary",
        "hercules.list_models",
        "hercules.verify_vault",
    }
    for case in cases["positive"]:
        assert case["description"].strip()
        assert case["prompt"].strip()
        assert case["expected_behavior"].strip()
        triggered = {name.strip() for name in case["tools_triggered"].split(",")}
        assert triggered
        assert triggered <= allowed_tools

    for case in cases["negative"]:
        assert case["description"].strip()
        assert case["prompt"].strip()


def test_plugin_has_first_party_website_and_support_urls():
    manifest = json.loads(Path("plugin.json").read_text())
    interface = manifest["extensions"]["com.openai"]["interface"]
    main = Path("hercules-ai/app/main.py").read_text()

    assert interface["websiteURL"] == "https://hercules-mcp.onrender.com/plugin"
    assert interface["supportURL"] == "https://hercules-mcp.onrender.com/plugin/support"
    assert '@app.get("/plugin")' in main
    assert '@app.get("/plugin/support")' in main
    assert "Hercules by SauceApproved enterprise LLC" in main
    assert "support" in main.lower()
