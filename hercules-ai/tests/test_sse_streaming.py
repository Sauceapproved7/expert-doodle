import pytest
from fastapi.responses import StreamingResponse
from app.main import ChatRequest, chat

@pytest.mark.asyncio
async def test_stream_request_returns_sse_response(monkeypatch):
    class FakeResponse:
        def raise_for_status(self): pass
        async def aiter_text(self):
            yield 'data: {"choices":[{"delta":{"content":"Hi"}}]}\\n\\n'
            yield 'data: [DONE]\\n\\n'
    class Ctx:
        async def __aenter__(self): return FakeResponse()
        async def __aexit__(self,*args): pass
    class Client:
        def __init__(self,*args,**kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        def stream(self,*args,**kwargs): return Ctx()
    monkeypatch.setattr("app.main.httpx.AsyncClient",Client)
    monkeypatch.setattr("app.main.DB",":memory:")
    response=await chat(ChatRequest(messages=[{"role":"user","content":"go"}],stream=True))
    assert isinstance(response,StreamingResponse)
    assert response.media_type=="text/event-stream"
