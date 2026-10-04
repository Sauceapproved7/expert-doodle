import json, os, platform, time, urllib.request
from typing import Any
from .sovereign import choose_model, mission_plan
from .vault import list_events, verify_chain

SERVER={"name":"hercules-mcp","version":"1.0.0"}
PROTOCOL="2025-06-18"

TOOLS={
 "hercules.command.status":{"description":"ChatGPT-facing read-only Hercules status command.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.command.mission":{"description":"ChatGPT-facing non-executing mission planning command.","inputSchema":{"type":"object","properties":{"goal":{"type":"string","minLength":1,"maxLength":2000}},"required":["goal"],"additionalProperties":False}},
 "hercules.command.vault":{"description":"ChatGPT-facing read-only Vault status and recent events command.","inputSchema":{"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100}},"additionalProperties":False}},
 "hercules.command.models":{"description":"ChatGPT-facing read-only installed-model inventory command.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.command.verify":{"description":"ChatGPT-facing read-only Vault verification command.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.status":{
   "description":"Read-only status of the Hercules MCP runtime.",
   "inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.echo":{
   "description":"Return supplied text. Useful for MCP connectivity tests.",
   "inputSchema":{"type":"object","properties":{"text":{"type":"string","maxLength":10000}},"required":["text"],"additionalProperties":False}},
 "hercules.sovereign.status":{"description":"Read-only sovereign runtime boundary status.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.models.recommend":{"description":"Recommend a local model tier from hardware facts.","inputSchema":{"type":"object","properties":{"ram_gb":{"type":"number","minimum":0},"vram_gb":{"type":"number","minimum":0}},"additionalProperties":False}},
 "hercules.models.installed":{"description":"Read installed local models from the configured local model backend.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.mission.plan":{"description":"Create a non-executing, authorization-gated mission plan.","inputSchema":{"type":"object","properties":{"goal":{"type":"string","minLength":1,"maxLength":2000}},"required":["goal"],"additionalProperties":False}},
 "hercules.vault.status":{"description":"Read-only Black Box Vault status.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}},
 "hercules.vault.events":{"description":"Read recent Black Box Vault events.","inputSchema":{"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100}},"additionalProperties":False}},
 "hercules.vault.verify":{"description":"Verify the Black Box Vault cryptographic hash chain without mutating it.","inputSchema":{"type":"object","properties":{},"additionalProperties":False}}
}

def list_tools():
    annotation={"readOnlyHint":True,"openWorldHint":False,"destructiveHint":False}
    return [{"name":k,**v,"annotations":{**annotation,"title":v["description"]}} for k,v in TOOLS.items()]

def call_tool(name:str,args:dict[str,Any]):
    if name=="hercules.command.status":
        status=json.loads(call_tool("hercules.status",{})["content"][0]["text"])
        public={"ok":bool(status.get("ok")),"service":status.get("server",{}).get("name","hercules-mcp"),"mutation_authority":False}
        return {"content":[{"type":"text","text":json.dumps(public,sort_keys=True)}]}
    if name=="hercules.command.mission":
        plan=json.loads(call_tool("hercules.mission.plan",args)["content"][0]["text"])
        public={"goal":plan.get("goal"),"stages":plan.get("stages",[]),"mutation_requires_authorization":bool(plan.get("mutation_requires_authorization",True))}
        return {"content":[{"type":"text","text":json.dumps(public,sort_keys=True)}]}
    if name=="hercules.command.vault":
        limit=args.get("limit",25)
        status=json.loads(call_tool("hercules.vault.status",{})["content"][0]["text"])
        events=json.loads(call_tool("hercules.vault.events",{"limit":limit})["content"][0]["text"])
        actions=[event.get("action") for event in events if isinstance(event,dict) and isinstance(event.get("action"),str)]
        public={"append_only":bool(status.get("append_only")),"mutation_authority":False,"event_count":int(status.get("event_count",0)),"recent_actions":actions}
        return {"content":[{"type":"text","text":json.dumps(public,sort_keys=True)}]}
    if name=="hercules.command.models":
        inventory=json.loads(call_tool("hercules.models.installed",{})["content"][0]["text"])
        installed=[{"name":model.get("name"),"size":model.get("size")} for model in inventory.get("installed",[]) if isinstance(model,dict) and model.get("name")]
        public={"installed":installed,"count":len(installed),"mutation_authority":False}
        return {"content":[{"type":"text","text":json.dumps(public,sort_keys=True)}]}
    if name=="hercules.command.verify":
        verification=json.loads(call_tool("hercules.vault.verify",{})["content"][0]["text"])
        public={"valid":bool(verification.get("valid")),"events":int(verification.get("events",0))}
        return {"content":[{"type":"text","text":json.dumps(public,sort_keys=True)}]}
    if name=="hercules.status":
        return {"content":[{"type":"text","text":json.dumps({
          "ok":True,"server":SERVER,"protocol":PROTOCOL,
          "python":platform.python_version(),"time":int(time.time())})}]}
    if name=="hercules.sovereign.status":
        return {"content":[{"type":"text","text":json.dumps({"local_first":True,"mutation_authority":False,"default_deny":True})}]}
    if name=="hercules.models.recommend":
        return {"content":[{"type":"text","text":json.dumps(choose_model(args),sort_keys=True)}]}
    if name=="hercules.models.installed":
        base=os.getenv("HERCULES_MODEL_BASE_URL","http://ollama:11434").rstrip("/")
        try:
            with urllib.request.urlopen(f"{base}/api/tags", timeout=5) as response:
                data=json.load(response)
        except Exception as e:
            raise ValueError(f"Local model inventory unavailable: {type(e).__name__}")
        models=[
            {"name":m.get("name"),"size":m.get("size"),"modified_at":m.get("modified_at")}
            for m in data.get("models",[]) if isinstance(m,dict) and m.get("name")
        ]
        return {"content":[{"type":"text","text":json.dumps({
            "installed":models,"count":len(models),"mutation_authority":False
        },sort_keys=True)}]}
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
        value=args.get("text")
        if not isinstance(value,str) or len(value)>10000:
            raise ValueError("Invalid text")
        return {"content":[{"type":"text","text":value}]}
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
