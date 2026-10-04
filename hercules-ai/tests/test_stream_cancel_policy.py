from pathlib import Path


def test_stream_persistence_requires_clean_done_marker():
    source=Path("hercules-ai/app/main.py").read_text()
    assert 'stream_complete=False' in source
    assert 'if line.startswith("data: ") and line[6:]=="[DONE]":' in source
    assert 'stream_complete=True' in source
    assert 'if answer and stream_complete:' in source


def test_partial_stream_is_not_persisted_as_complete_assistant_message():
    source=Path("hercules-ai/app/main.py").read_text()
    assert 'if answer and stream_complete:' in source
