from app.main import ChatRequest

def test_chat_request_supports_stream_flag():
    req=ChatRequest(messages=[{"role":"user","content":"go"}],stream=True)
    assert req.stream is True

def test_chat_stream_defaults_off_for_compatibility():
    req=ChatRequest(messages=[{"role":"user","content":"go"}])
    assert req.stream is False
