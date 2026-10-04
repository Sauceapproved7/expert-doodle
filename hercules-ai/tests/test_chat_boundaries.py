import pytest
from pydantic import ValidationError
from app.main import ChatRequest

def test_chat_roles_are_allowlisted():
    for role in ("system","user","assistant","tool"):
        ChatRequest(messages=[{"role":role,"content":"ok"}])
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role":"owner-admin","content":"no"}])

def test_chat_request_message_count_is_bounded():
    ChatRequest(messages=[{"role":"user","content":"ok"} for _ in range(200)])
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role":"user","content":"x"} for _ in range(201)])

def test_chat_requires_at_least_one_message():
    with pytest.raises(ValidationError): ChatRequest(messages=[])
