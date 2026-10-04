from pathlib import Path

def test_ui_preserves_conversation_id_across_turns():
    html=Path("hercules-ai/ui/index.html").read_text()
    assert 'let conversationId=null' in html
    assert 'response.headers.get("X-Hercules-Conversation-Id")' in html
    assert 'conversation_id:conversationId' in html
