from pathlib import Path


def test_stream_has_periodic_keepalive_without_model_content():
    source=Path("hercules-ai/app/main.py").read_text()
    assert 'KEEPALIVE_SECONDS' in source
    assert 'yield ": keepalive\\n\\n"' in source
    assert 'asyncio.wait_for' in source
