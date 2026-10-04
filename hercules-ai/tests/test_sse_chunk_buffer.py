import asyncio
import json
from hercules_ai_chunk_buffer_spec import consume_sse_chunks


def test_split_sse_json_is_reassembled_before_parsing():
    chunks=[
        'data: {"choices":[{"delta":{"content":"Hel',
        'lo"}}]}\n\n',
        'data: [DONE]\n\n',
    ]
    assert consume_sse_chunks(chunks) == "Hello"


def test_multiple_events_and_trailing_partial_are_safe():
    chunks=['data: '+json.dumps({"choices":[{"delta":{"content":"A"}}]})+'\n\ndata: ', json.dumps({"choices":[{"delta":{"content":"B"}}]})+'\n\n']
    assert consume_sse_chunks(chunks) == "AB"
