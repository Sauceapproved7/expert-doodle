import os, sqlite3, time, uuid, json, asyncio, secrets, struct, zlib, contextlib, base64
from pathlib import Path
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse, Response, HTMLResponse
from pydantic import BaseModel, Field
from typing import Literal
from .mcp_runtime import PUBLIC_MCP_SCOPES, effective_allowed_hosts, hercules_mcp, oauth_tool_contract_ready, transport_security
from .oauth_consent import render_oauth_consent
from .oauth_validation import jwks_has_asymmetric_signing_key, validate_introspection_claims, validate_supabase_claims
from .sovereign import choose_model, mission_plan
from .speed import speed_profile

DB=os.getenv("HERCULES_DB","/data/hercules.db")
BASE=os.getenv("HERCULES_MODEL_BASE_URL","http://ollama:11434").rstrip("/")
DEFAULT=os.getenv("HERCULES_DEFAULT_MODEL","qwen2.5:7b")
FAST_MODEL=os.getenv("HERCULES_FAST_MODEL",DEFAULT)
DEEP_MODEL=os.getenv("HERCULES_DEEP_MODEL",DEFAULT)
KEEPALIVE_SECONDS=float(os.getenv("HERCULES_SSE_KEEPALIVE_SECONDS","15"))
MCP_TOKEN=os.getenv("HERCULES_MCP_TOKEN","")
PUBLIC_HOSTED=os.getenv("HERCULES_PUBLIC_HOSTED","0").lower() in {"1","true","yes"}
OPENAI_APPS_CHALLENGE=os.getenv("OPENAI_APPS_CHALLENGE","").strip()
MCP_RESOURCE=os.getenv("HERCULES_MCP_RESOURCE","").strip()
MCP_AUTHORIZATION_SERVER=os.getenv("HERCULES_MCP_AUTHORIZATION_SERVER","").strip()
MCP_OAUTH_INTROSPECTION_URL=os.getenv("HERCULES_MCP_OAUTH_INTROSPECTION_URL","").strip()
MCP_OAUTH_CLIENT_ID=os.getenv("HERCULES_MCP_OAUTH_CLIENT_ID","").strip()
MCP_OAUTH_CLIENT_SECRET=os.getenv("HERCULES_MCP_OAUTH_CLIENT_SECRET","").strip()
MCP_OAUTH_REQUIRED_SCOPES=set(PUBLIC_MCP_SCOPES)
MCP_OAUTH_MODE=os.getenv("HERCULES_MCP_OAUTH_MODE","").strip().lower()
MCP_OAUTH_SUPABASE_ORIGIN=os.getenv("HERCULES_MCP_OAUTH_SUPABASE_ORIGIN","").strip().rstrip("/")
MCP_OAUTH_USER_PATH="/auth/v1/oauth/userinfo"
MCP_OAUTH_PUBLISHABLE_KEY=os.getenv("HERCULES_MCP_OAUTH_PUBLISHABLE_KEY","").strip()
MCP_OAUTH_ISSUER=os.getenv("HERCULES_MCP_OAUTH_ISSUER","").strip()
MCP_OAUTH_AUDIENCE=os.getenv("HERCULES_MCP_OAUTH_AUDIENCE","authenticated").strip()
mcp_asgi=hercules_mcp.streamable_http_app(
    streamable_http_path="/",
    stateless_http=True,
    json_response=True,
    transport_security=transport_security(),
)

@contextlib.asynccontextmanager
async def lifespan(_app:FastAPI):
    public_oauth_configured=(
        MCP_OAUTH_MODE=="introspection"
        and bool(MCP_RESOURCE and MCP_AUTHORIZATION_SERVER and MCP_OAUTH_INTROSPECTION_URL and MCP_OAUTH_CLIENT_ID and MCP_OAUTH_CLIENT_SECRET)
    ) or (
        MCP_OAUTH_MODE=="supabase"
        and bool(MCP_RESOURCE and MCP_AUTHORIZATION_SERVER and MCP_OAUTH_SUPABASE_ORIGIN and MCP_OAUTH_PUBLISHABLE_KEY and MCP_OAUTH_ISSUER)
    )
    oauth_contract_ready=await oauth_tool_contract_ready()
    oauth_provider_discovery_ready, oauth_dynamic_registration_advertised=await probe_supabase_oauth_discovery()
    oauth_asymmetric_signing_ready=await probe_supabase_asymmetric_signing()
    readiness={"event":"hercules_mcp_readiness",
               "public_oauth_configured":public_oauth_configured,
               "oauth_tool_contract_ready":oauth_contract_ready,
               "oauth_provider_discovery_ready":oauth_provider_discovery_ready,
               "oauth_dynamic_registration_advertised":oauth_dynamic_registration_advertised,
               "oauth_asymmetric_signing_ready":oauth_asymmetric_signing_ready,
               "owner_token_configured":bool(MCP_TOKEN),
               "domain_challenge_configured":bool(OPENAI_APPS_CHALLENGE),
               "transport_allowlist_configured":bool(effective_allowed_hosts())}
    print(json.dumps(readiness,sort_keys=True),flush=True)
    if public_oauth_configured and not oauth_contract_ready:
        raise RuntimeError("Hercules MCP OAuth tool contract is not ready")
    async with hercules_mcp.session_manager.run():
        yield

app=FastAPI(title="Hercules AI Core",version="1.1.0",lifespan=lifespan)

async def probe_supabase_oauth_discovery()->tuple[bool,bool]:
    if not MCP_OAUTH_SUPABASE_ORIGIN.startswith("https://"):
        return False,False
    discovery_url=MCP_OAUTH_SUPABASE_ORIGIN+"/.well-known/oauth-authorization-server/auth/v1"
    try:
        async with httpx.AsyncClient(timeout=5.0,follow_redirects=False) as client:
            response=await client.get(discovery_url)
        if response.status_code!=200:
            return False,False
        payload=response.json()
    except (httpx.HTTPError,ValueError):
        return False,False
    expected_issuer=MCP_OAUTH_SUPABASE_ORIGIN+"/auth/v1"
    discovery_ready=(
        payload.get("issuer")==expected_issuer
        and isinstance(payload.get("authorization_endpoint"),str)
        and isinstance(payload.get("token_endpoint"),str)
    )
    dynamic_registration=(
        discovery_ready
        and isinstance(payload.get("registration_endpoint"),str)
        and payload.get("registration_endpoint").startswith(MCP_OAUTH_SUPABASE_ORIGIN+"/")
    )
    return bool(discovery_ready),bool(dynamic_registration)


async def probe_supabase_asymmetric_signing()->bool:
    if not MCP_OAUTH_SUPABASE_ORIGIN.startswith("https://"):
        return False
    jwks_url=MCP_OAUTH_SUPABASE_ORIGIN+"/auth/v1/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient(timeout=5.0,follow_redirects=False) as client:
            response=await client.get(jwks_url)
        if response.status_code!=200:
            return False
        payload=response.json()
    except (httpx.HTTPError,ValueError):
        return False
    return jwks_has_asymmetric_signing_key(payload)



async def validate_introspection_mcp_token(token:str)->bool:
    if not (
        MCP_OAUTH_INTROSPECTION_URL
        and MCP_OAUTH_CLIENT_ID
        and MCP_OAUTH_CLIENT_SECRET
        and MCP_RESOURCE
    ):
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response=await client.post(
                MCP_OAUTH_INTROSPECTION_URL,
                data={"token":token},
                auth=(MCP_OAUTH_CLIENT_ID,MCP_OAUTH_CLIENT_SECRET),
            )
        if response.status_code != 200:
            return False
        payload=response.json()
    except (httpx.HTTPError, ValueError):
        return False
    return validate_introspection_claims(
        payload,
        issuer=MCP_AUTHORIZATION_SERVER,
        resource=MCP_RESOURCE,
        required_scopes=MCP_OAUTH_REQUIRED_SCOPES,
        now=time.time(),
    )

def _decode_jwt_payload(token:str)->dict|None:
    parts=token.split(".")
    if len(parts)!=3:
        return None
    try:
        padded=parts[1]+"="*(-len(parts[1])%4)
        payload=json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
    except (ValueError,UnicodeDecodeError,json.JSONDecodeError):
        return None
    return payload if isinstance(payload,dict) else None

async def validate_supabase_mcp_token(token:str)->bool:
    if not (MCP_OAUTH_SUPABASE_ORIGIN and MCP_OAUTH_PUBLISHABLE_KEY and MCP_OAUTH_ISSUER):
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response=await client.get(
                MCP_OAUTH_SUPABASE_ORIGIN+MCP_OAUTH_USER_PATH,
                headers={"Authorization":f"Bearer {token}"},
            )
        if response.status_code!=200:
            return False
        user=response.json()
    except (httpx.HTTPError,ValueError):
        return False
    payload=_decode_jwt_payload(token)
    if payload is None or not isinstance(user,dict):
        return False
    return validate_supabase_claims(
        payload,
        user_subject=str(user.get("sub","")),
        email_verified=user.get("email_verified") is True,
        issuer=MCP_OAUTH_ISSUER,
        audience=MCP_OAUTH_AUDIENCE,
        required_scopes=MCP_OAUTH_REQUIRED_SCOPES,
        now=time.time(),
    )

async def validate_public_mcp_token(token:str)->bool:
    if MCP_OAUTH_MODE=="supabase":
        return await validate_supabase_mcp_token(token)
    if MCP_OAUTH_MODE=="introspection":
        return await validate_introspection_mcp_token(token)
    return False

@app.middleware("http")
async def protect_mcp(request, call_next):
    if request.url.path.startswith("/mcp"):
        if PUBLIC_HOSTED and not MCP_TOKEN:
            return Response(
                content='{"detail":"MCP authentication is not configured"}',
                status_code=503,
                media_type="application/json",
            )
        supplied=request.headers.get("Authorization","")
        expected=f"Bearer {MCP_TOKEN}" if MCP_TOKEN else ""
        owner_authorized=bool(expected) and secrets.compare_digest(supplied,expected)
        public_authorized=False
        if not owner_authorized and supplied.startswith("Bearer "):
            public_authorized=await validate_public_mcp_token(supplied[7:])
        if not owner_authorized and not public_authorized:
            return Response(
                content='{"detail":"Unauthorized"}',
                status_code=401,
                media_type="application/json",
                headers={"WWW-Authenticate":f'Bearer resource_metadata="{str(request.base_url).rstrip("/")}.well-known/oauth-protected-resource"'},
            )
    return await call_next(request)

app.mount("/mcp",mcp_asgi)

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
UI_DIR=Path(__file__).resolve().parent.parent/"ui"
UI=UI_DIR/"index.html"

def _png_icon(size:int)->bytes:
    def pixel(x:int,y:int)->bytes:
        dark=(8,10,13); orange=(255,107,34); light=(244,241,232)
        # Shield border + simple Hercules H monogram.
        cx=size/2; cy=size/2
        shield=max(abs((x-cx)/(size*.31)),abs((y-cy)/(size*.38)))
        shield_edge=.91 <= shield <= 1.0
        h_left=abs(x-size*.38) <= size*.035 and size*.31 <= y <= size*.69
        h_right=abs(x-size*.62) <= size*.035 and size*.31 <= y <= size*.69
        h_bar=abs(y-size*.50) <= size*.035 and size*.38 <= x <= size*.62
        c=light if (h_left or h_right or h_bar) else orange if shield_edge else dark
        return bytes(c)
    raw=b"".join(b"\x00"+b"".join(pixel(x,y) for x in range(size)) for y in range(size))
    def chunk(kind:bytes,data:bytes)->bytes:
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")

@app.get("/",include_in_schema=False)
async def command_center():
    return FileResponse(UI)

@app.get("/manifest.webmanifest",include_in_schema=False)
async def app_manifest():
    return FileResponse(UI_DIR/"manifest.webmanifest",media_type="application/manifest+json")

@app.get("/service-worker.js",include_in_schema=False)
async def service_worker():
    return FileResponse(UI_DIR/"service-worker.js",media_type="application/javascript",headers={"Service-Worker-Allowed":"/","Cache-Control":"no-cache"})

@app.get("/app-icon-192.png",include_in_schema=False)
async def app_icon_192():
    return Response(content=_png_icon(192),media_type="image/png",headers={"Cache-Control":"public, max-age=86400"})

@app.get("/app-icon-512.png",include_in_schema=False)
async def app_icon_512():
    return Response(content=_png_icon(512),media_type="image/png",headers={"Cache-Control":"public, max-age=86400"})

@app.get("/plugin")
async def plugin_website():
    return HTMLResponse(
        content="""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules by SauceApproved</title></head><body><main><h1>Hercules by SauceApproved enterprise LLC</h1><p>Hercules is a bounded read-only community plugin for service status, non-executing mission planning, minimized Vault summaries, model inventory, and Vault evidence verification.</p><p>The public tool surface cannot deploy, delete records, change accounts, process payments, or access private credentials.</p><p><a href="/plugin/support">Customer support</a></p></main></body></html>""",
        headers={"Cache-Control":"public, max-age=300","X-Content-Type-Options":"nosniff"},
    )


@app.get("/plugin/support")
async def plugin_support():
    return HTMLResponse(
        content="""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Support</title></head><body><main><h1>Hercules Support</h1><p>Hercules by SauceApproved enterprise LLC</p><p>For non-sensitive plugin support, bug reports, or documentation issues, use the Hercules repository issue tracker.</p><p><a href="https://github.com/Sauceapproved7/expert-doodle/issues">Open Hercules support</a></p><p>Do not post passwords, API keys, access tokens, private customer data, or security vulnerabilities in a public issue. Use GitHub private vulnerability reporting for security reports when available.</p></main></body></html>""",
        headers={"Cache-Control":"public, max-age=300","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"},
    )


@app.get("/oauth/consent")
async def oauth_consent():
    if (
        MCP_OAUTH_MODE!="supabase"
        or not MCP_OAUTH_SUPABASE_ORIGIN
        or not MCP_OAUTH_PUBLISHABLE_KEY
    ):
        return Response(
            content='{"detail":"oauth_consent_not_configured"}',
            status_code=503,
            media_type="application/json",
        )
    return HTMLResponse(
        content=render_oauth_consent(
            MCP_OAUTH_SUPABASE_ORIGIN,
            MCP_OAUTH_PUBLISHABLE_KEY,
        ),
        headers={
            "Cache-Control":"no-store",
            "Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline' https://esm.sh; connect-src "+MCP_OAUTH_SUPABASE_ORIGIN+"; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            "Referrer-Policy":"no-referrer",
            "X-Content-Type-Options":"nosniff",
            "X-Frame-Options":"DENY",
        },
    )

@app.get("/.well-known/openai-apps-challenge",include_in_schema=False)
async def openai_apps_challenge():
    if not OPENAI_APPS_CHALLENGE:
        raise HTTPException(404,"Not configured")
    return Response(content=OPENAI_APPS_CHALLENGE,media_type="text/plain")

@app.get("/.well-known/oauth-protected-resource",include_in_schema=False)
async def oauth_protected_resource():
    if not MCP_RESOURCE or not MCP_AUTHORIZATION_SERVER:
        raise HTTPException(404,"Not configured")
    return {
        "resource": MCP_RESOURCE,
        "authorization_servers": [MCP_AUTHORIZATION_SERVER],
        "scopes_supported": list(PUBLIC_MCP_SCOPES),
        "bearer_methods_supported": ["header"],
    }

@app.get("/health")
async def health():
    return {"ok":True,"service":"hercules-ai","model":DEFAULT,"mcp":"/mcp"}


@app.get("/v1/models")
async def model_inventory():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r=await client.get(f"{BASE}/api/tags")
            r.raise_for_status()
            data=r.json()
    except Exception as e:
        raise HTTPException(502,f"Local model inventory unavailable: {type(e).__name__}")
    models=[{"name":m.get("name"),"size":m.get("size"),"modified_at":m.get("modified_at")} for m in data.get("models",[]) if m.get("name")]
    return {"installed":models,"count":len(models),"backend":"local"}

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
        cid=req.conversation_id or str(uuid.uuid4())
        conn=db(); now=int(time.time())
        for i,m in enumerate(req.messages):
            conn.execute("insert into messages(id,conversation_id,role,content,created_at,sequence) values(?,?,?,?,?,?)",(str(uuid.uuid4()),cid,m.role,m.content,now,i))
        conn.commit(); conn.close()
        model_by_slot={"fast":FAST_MODEL,"balanced":DEFAULT,"deep":DEEP_MODEL}
        payload={"model":req.model or model_by_slot[profile["model_slot"]],"messages":[m.model_dump() for m in req.messages],"stream":True,"max_tokens":profile["max_tokens"]}
        async def events():
            answer=[]
            stream_complete=False
            try:
                async with httpx.AsyncClient(timeout=profile["timeout_seconds"]) as client:
                    async with client.stream("POST",f"{BASE}/v1/chat/completions",json=payload) as r:
                        r.raise_for_status()
                        buffer=""
                        iterator=r.aiter_text().__aiter__()
                        pending_next=None
                        while True:
                            if pending_next is None:
                                pending_next=asyncio.create_task(iterator.__anext__())
                            try:
                                chunk=await asyncio.wait_for(asyncio.shield(pending_next),timeout=KEEPALIVE_SECONDS)
                                pending_next=None
                            except asyncio.TimeoutError:
                                yield ": keepalive\\n\\n"
                                continue
                            except StopAsyncIteration:
                                pending_next=None
                                break
                            if chunk:
                                buffer+=chunk
                                while "\n" in buffer:
                                    line,buffer=buffer.split("\n",1)
                                    line=line.rstrip("\r")
                                    if line.startswith("data: ") and line[6:]=="[DONE]":
                                        stream_complete=True
                                    elif line.startswith("data: "):
                                        try: answer.append(json.loads(line[6:])["choices"][0]["delta"].get("content",""))
                                        except (json.JSONDecodeError,KeyError,IndexError,TypeError): pass
                                yield chunk
                if answer and stream_complete:
                    conn=db()
                    conn.execute("insert into messages(id,conversation_id,role,content,created_at,sequence) values(?,?,?,?,?,?)",(str(uuid.uuid4()),cid,"assistant","".join(answer),int(time.time()),len(req.messages)))
                    conn.commit(); conn.close()
            except Exception as e:
                yield "data: {\"error\":\"Local model backend unavailable: "+type(e).__name__+"\"}\\n\\n"
        return StreamingResponse(events(),media_type="text/event-stream",headers={"X-Hercules-Conversation-Id":cid,"Cache-Control":"no-cache","X-Accel-Buffering":"no"})
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
