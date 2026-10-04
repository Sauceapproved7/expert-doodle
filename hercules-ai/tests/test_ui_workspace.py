from pathlib import Path

def test_workspace_has_distinct_live_surfaces():
    html=Path("hercules-ai/ui/index.html").read_text()
    for label in ["COMMAND STREAM","MEMORY VAULT","MODEL ARSENAL","MISSION COMMANDER"]:
        assert label in html
    assert "/v1/chat/completions" in html
    assert "/v1/memory/search" in html
