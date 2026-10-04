from pathlib import Path

def test_command_center_has_live_chat_surface():
    html=Path("hercules-ai/ui/index.html").read_text()
    assert 'id="chatInput"' in html
    assert 'id="chatSend"' in html
    assert 'id="chatLog"' in html
    assert 'fetch("/v1/chat/completions"' in html
    assert '"speed_mode":speed.value' in html
    assert '"stream":true' in html

def test_speed_control_ids_are_unique():
    html=Path("hercules-ai/ui/index.html").read_text()
    assert html.count('id="speedMode"')==1
    assert html.count('id="speedReadout"')==1
