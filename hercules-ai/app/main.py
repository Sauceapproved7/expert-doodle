import os, sqlite3, time, uuid
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Literal
from .mcp_server import dispatch
from .sovereign import choose_model, mission_plan
from .speed import speed_profile

DB=os.getenv("HERCULES_DB","/data/hercules.db")
BASE=os.getenv("HERCULES_MODEL_BASE_URL","http://ollama:11434").rstrip("/")
DEFAULT=os.getenv("HERCULES_DEFAULT_MODEL","qwen2.5:7b")
FAST_MODEL=os.getenv("HERCULES_FAST_MODEL",DEFAULT)
DEEP_MODEL=os.getenv("HERCULES_DEEP_MODEL",DEFAULT)
app=FastAPI(title="Hercules AI Core",version="1.1.0")

def db():
    c=sqlite3.connect(DB)
    c.execute("""create table if not exists messages(
      id text primary key, conversation_id text not null, role text not null,
      content text not null, created_at integer not null, sequence integer not null default 0)""")
    c.commit(); return c

class Message(BaseModel):
    role:Literal["system","user","assistant","tool"]
    content:str=Field(min_length=1,max_length=100000)
class ChatRequest(BaseModel):
    model:str|None=None
    messages:list[Message]=Field(min_length=1,max_length=200)
    conversation_id:str|None=None
    stream:bool=False
    speed_mode:str|None="balanced"
class HardwareRequest(BaseModel):
    ram_gb:float=0
    vram_gb:float=0
class MissionRequest(BaseModel):
    goal:str=Field(min_length=1,max_length=2000)
class RpcRequest(BaseModel):
    jsonrpc:str
    id:int|str|None=None
    method:str
    params:dict={}

@app.get("/health")
async def health():
    return {"ok":True,"service":"hercules-ai","model":DEFAULT,"mcp":"/mcp"}

@app.post("/mcp")
async def mcp(req:RpcRequest):
    if req.jsonrpc!="2.0":
        raise HTTPException(400,"JSON-RPC 2.0 required")
    try:
        result=dispatch(req.method,req.params)
        return {"jsonrpc":"2.0","id":req.id,"result":result}
    except KeyError as e:
        return {"jsonrpc":"2.0","id":req.id,"error":{"code":-32601,"message":str(e)}}
    except (ValueError,TypeError) as e:
        return {"jsonrpc":"2.0","id":req.id,"error":{"code":-32602,"message":str(e)}}

@app.post("/v1/models/select")
async def select_model(req:HardwareRequest):
    return choose_model(req.model_dump())

@app.post("/v1/missions/plan")
async def create_mission(req:MissionRequest):
    return mission_plan(req.goal)

@app.get("/v1/speed/{mode}")
async def get_speed(mode:str):
    try:
        return speed_profile(mode)
    except ValueError as e:
        raise HTTPException(400,str(e))

@app.post("/v1/chat/completions")
async def chat(req:ChatRequest):
    if req.stream:
        try:
            profile=speed_profile(req.speed_mode)
        except ValueError as e:
            raise HTTPException(400,str(e))
        model_by_slot={"fast":FAST_MODEL,"balanced":DEFAULT,"deep":DEEP_MODEL}
        payload={"model":req.model or model_by_slot[profile["model_slot"]],"messages":[m.model_dump() for m in req.messages],"stream":True,"max_tokens":profile["max_tokens"]}
        async def events():
            try:
                async with httpx.AsyncClient(timeout=profile["timeout_seconds"]) as client:
                    async with client.stream("POST",f"{BASE}/v1/chat/completions",json=payload) as r:
                        r.raise_for_status()
                        async for chunk in r.aiter_text():
                            if chunk: yield chunk
            except Exception as e:
                yield "data: {\"error\":\"Local model backend unavailable: "+type(e).__name__+"\"}\\n\\n"
        return StreamingResponse(events(),media_type="text/event-stream")
    cid=req.conversation_id or str(uuid.uuid4())
    conn=db()
    now=int(time.time())
    for i,m in enumerate(req.messages):
        conn.execute("insert into messages(id,conversation_id,role,content,created_at,sequence) values(?,?,?,?,?,?)",
                     (str(uuid.uuid4()),cid,m.role,m.content,now,i))
    conn.commit()
    try:
        profile=speed_profile(req.speed_mode)
    except ValueError as e:
        raise HTTPException(400,str(e))
    model_by_slot={"fast":FAST_MODEL,"balanced":DEFAULT,"deep":DEEP_MODEL}
    payload={"model":req.model or model_by_slot[profile["model_slot"]],
             "messages":[m.model_dump() for m in req.messages],
             "stream":False,
             "max_tokens":profile["max_tokens"]}
    try:
        async with httpx.AsyncClient(timeout=profile["timeout_seconds"]) as client:
            r=await client.post(f"{BASE}/v1/chat/completions",json=payload)
            r.raise_for_status()
            out=r.json()
    except Exception as e:
        raise HTTPException(502,f"Local model backend unavailable: {type(e).__name__}")
    try:
        answer=out["choices"][0]["message"]["content"]
        conn.execute("insert into messages(id,conversation_id,role,content,created_at,sequence) values(?,?,?,?,?,?)",
                     (str(uuid.uuid4()),cid,"assistant",answer,int(time.time()),len(req.messages)))
        conn.commit()
    finally:
        conn.close()
    out["conversation_id"]=cid
    return out

@app.get("/v1/conversations/{conversation_id}")
async def conversation(conversation_id:str):
    conn=db()
    rows=conn.execute("select role,content,created_at from messages where conversation_id=? order by created_at,sequence,id",(conversation_id,)).fetchall()
    conn.close()
    return {"conversation_id":conversation_id,
            "messages":[{"role":r,"content":c,"created_at":t} for r,c,t in rows]}
