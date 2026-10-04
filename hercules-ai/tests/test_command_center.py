from pathlib import Path

def test_command_center_has_hercules_surfaces():
    html=Path("hercules-ai/ui/index.html").read_text()
    for label in ["MISSION COMMANDER","MODEL ARSENAL","BLACK BOX VAULT","SOVEREIGN MODE"]:
        assert label in html
    assert "ChatGPT" not in html
