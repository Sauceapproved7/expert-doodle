from pathlib import Path


def test_keepalive_does_not_cancel_upstream_iterator_on_timeout():
    source = Path("hercules-ai/app/main.py").read_text()
    assert "asyncio.shield" in source
    assert "pending_next" in source
    assert "asyncio.wait_for(iterator.__anext__()" not in source
