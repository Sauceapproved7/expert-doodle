import json, os, platform, time, urllib.request
from typing import Any
from .sovereign import choose_model, mission_plan
from .vault import list_events, verify_chain

SERVER={"name":"hercules-mcp","version":"1.0.0"}
PROTOCOL="2025-06-18"

TOOLS={
 "hercules.status":{
   "description":"Read-only status of the Hercules MCP runtime.",
   "inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.echo":{
   "description":"Return supplied text. Useful for MCP connectivity tests.",
   "inputSchema":{"type":"object","properties":{"text":{"type":"string","maxLength":10000}},"required":["text"],"additionalProperties":False}},
 "hercules.sovereign.status":{"description":"Read-only sovereign runtime boundary status.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.models.recommend":{"description":"Recommend a local model tier from hardware facts.","inputSchema":{"type":"object","properties":{"ram_gb":{"type":"number","minimum":0},"vram_gb":{"type":"number","minimum":0}},"additionalProperties":False}},\n "hercules.models.installed":{"description":"Read installed local models from the configured local model backend.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.mission.plan":{"description":"Create a non-executing, authorization-gated mission plan.","inputSchema":{"type":"object","properties":{"goal":{"type":"string","minLength":1,"maxLength":2000}},"required":["goal"],"additionalProperties":False}},
 "hercules.vault.status":{"description":"Read-only Black Box Vault status.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.vault.events":{"description":"Read recent Black Box Vault events.","inputSchema":{"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100}},"additionalProperties":False}},
 "hercules.vault.verify":{"description":"Verify the Black Box Vault cryptographic hash chain without mutating it.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}}
}

def list_tools():
    return [{"name":k,**v} for k,v in TOOLS.items()]

def call_tool(name:str,args:dict[str,Any]):
    if name=="hercules.status":
        return {"content":[{"type":"text","text":json.dumps({
          "ok":True,"server":SERVER,"protocol":PROTOCOL,
          "python":platform.python_version(),"time":int(time.time())})}]}
    if name=="hercules.sovereign.status":
        return {"content":[{"type":"text","text":json.dumps({"local_first":True,"mutation_authority":False,"default_deny":True})}]}
    if name=="hercules.models.recommend":
        return {"content":[{"type":"text","text":json.dumps(choose_model(args),sort_keys=True)}]}
    if name=="hercules.mission.plan":
        goal=args.get("goal")
        if not isinstance(goal,str) or not goal.strip() or len(goal)>2000: raise ValueError("Invalid goal")
        return {"content":[{"type":"text","text":json.dumps(mission_plan(goal),sort_keys=True)}]}
    if name=="hercules.vault.status":
        path=os.getenv("HERCULES_VAULT_DB","/data/hercules-vault.db")
        events=list_events(path,limit=500)
        return {"content":[{"type":"text","text":json.dumps({"append_only":True,"mutation_authority":False,"event_count":len(events)},sort_keys=True)}]}
    if name=="hercules.vault.verify":
        path=os.getenv("HERCULES_VAULT_DB","/data/hercules-vault.db")
        return {"content":[{"type":"text","text":json.dumps(verify_chain(path),sort_keys=True)}]}
    if name=="hercules.vault.events":
        limit=args.get("limit",25)
        if not isinstance(limit,int) or isinstance(limit,bool) or limit<1 or limit>100: raise ValueError("Invalid limit")
        path=os.getenv("HERCULES_VAULT_DB","/data/hercules-vault.db")
        return {"content":[{"type":"text","text":json.dumps(list_events(path,limit=limit),sort_keys=True)}]}
    if name=="hercules.echo":
        text=args.get("text")
        if not isinstance(text,str) or len(text)>10000:
            raise ValueError("Invalid text")
        return {"content":[{"type":"text","text":text}]}
    raise KeyError("Unknown or unauthorized tool")

def dispatch(method:str,params:dict[str,Any]):
    if method=="initialize":
        return {"protocolVersion":PROTOCOL,
                "capabilities":{"tools":{"listChanged":False}},
                "serverInfo":SERVER}
    if method=="ping": return {}
    if method=="tools/list": return {"tools":list_tools()}
    if method=="tools/call":
        return call_tool(params.get("name",""),params.get("arguments") or {})
    raise KeyError("Method not found")
