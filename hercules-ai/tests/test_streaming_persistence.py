import pytest
from app import main

@pytest.mark.asyncio
async def test_streaming_persists_user_and_assistant_messages(tmp_path,monkeypatch):
    monkeypatch.setattr(main,"DB",str(tmp_path/"chat.db"))
    class Resp:
        def raise_for_status(self): pass
        async def aiter_text(self):
            yield 'data: {"choices":[{"delta":{"content":"Hi"}}]}\\n\\n'
            yield 'data: {"choices":[{"delta":{"content":" there"}}]}\\n\\n'
            yield 'data: [DONE]\\n\\n'
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
    class Client:
        def __init__(self,*a,**k): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*a): pass
        def stream(self,*a,**k): return Resp()
    monkeypatch.setattr(main.httpx,"AsyncClient",Client)
    req=main.ChatRequest(messages=[{"role":"user","content":"go"}],stream=True,conversation_id="stream-1")
    response=await main.chat(req)
    async for _ in response.body_iterator: pass
    result=await main.conversation("stream-1")
    assert [m["content"] for m in result["messages"]]==["go","Hi there"]
