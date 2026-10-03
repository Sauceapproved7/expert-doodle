import os, sqlite3, time, uuid
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

DB=os.getenv("HERCULES_DB","/data/hercules.db")
BASE=os.getenv("HERCULES_MODEL_BASE_URL","http://ollama:11434").rstrip("/")
DEFAULT=os.getenv("HERCULES_DEFAULT_MODEL","qwen2.5:7b")
app=FastAPI(title="Hercules AI Core",version="1.0.0")

def db():
    c=sqlite3.connect(DB)
    c.execute("""create table if not exists messages(
      id text primary key, conversation_id text not null, role text not null,
      content text not null, created_at integer not null)""")
    c.commit(); return c

class Message(BaseModel):
    role:str
    content:str=Field(min_length=1,max_length=100000)
class ChatRequest(BaseModel):
    model:str|None=None
    messages:list[Message]
    conversation_id:str|None=None
    stream:bool=False

@app.get("/health")
async def health():
    return {"ok":True,"service":"hercules-ai","model":DEFAULT}

@app.post("/v1/chat/completions")
async def chat(req:ChatRequest):
    if req.stream:
        raise HTTPException(400,"Streaming is not enabled in v1.")
    cid=req.conversation_id or str(uuid.uuid4())
    conn=db()
    now=int(time.time())
    for m in req.messages:
        conn.execute("insert into messages values(?,?,?,?,?)",
                     (str(uuid.uuid4()),cid,m.role,m.content,now))
    conn.commit()
    payload={"model":req.model or DEFAULT,
             "messages":[m.model_dump() for m in req.messages],
             "stream":False}
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            r=await client.post(f"{BASE}/v1/chat/completions",json=payload)
            r.raise_for_status()
            out=r.json()
    except Exception as e:
        raise HTTPException(502,f"Local model backend unavailable: {type(e).__name__}")
    try:
        answer=out["choices"][0]["message"]["content"]
        conn.execute("insert into messages values(?,?,?,?,?)",
                     (str(uuid.uuid4()),cid,"assistant",answer,int(time.time())))
        conn.commit()
    finally:
        conn.close()
    out["conversation_id"]=cid
    return out

@app.get("/v1/conversations/{conversation_id}")
async def conversation(conversation_id:str):
    conn=db()
    rows=conn.execute("select role,content,created_at from messages where conversation_id=? order by created_at,id",(conversation_id,)).fetchall()
    conn.close()
    return {"conversation_id":conversation_id,
            "messages":[{"role":r,"content":c,"created_at":t} for r,c,t in rows]}
