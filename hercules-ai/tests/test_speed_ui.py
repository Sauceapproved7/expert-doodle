from pathlib import Path

def test_command_center_exposes_speed_dial():
    html=Path("hercules-ai/ui/index.html").read_text()
    assert "SPEED CONTROL" in html
    for mode in ["TURBO","FAST","BALANCED","DEEP","MAX"]:
        assert mode in html
    assert 'id="speedMode"' in html
