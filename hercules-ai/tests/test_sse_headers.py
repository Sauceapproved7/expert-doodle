from pathlib import Path

def test_streaming_response_disables_proxy_buffering_and_cache():
    source=Path("hercules-ai/app/main.py").read_text()
    assert '"Cache-Control":"no-cache"' in source
    assert '"X-Accel-Buffering":"no"' in source
    assert '"X-Hercules-Conversation-Id":cid' in source
