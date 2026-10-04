import time, uuid

def choose_model(hw):
    ram=float(hw.get("ram_gb",0)); vram=float(hw.get("vram_gb",0))
    if vram>=20 or ram>=64:
        return {"tier":"heavy","profile":"reasoning","local":True}
    if vram>=8 or ram>=24:
        return {"tier":"strong","profile":"balanced","local":True}
    return {"tier":"compact","profile":"efficient","local":True}

def mission_plan(goal):
    return {"id":str(uuid.uuid4()),"goal":goal,
      "stages":[{"name":x,"status":"pending"} for x in
        ("plan","build","test","security","deploy","verify")],
      "mutation_requires_authorization":True}

def vault_event(action,commit,details=None):
    return {"id":str(uuid.uuid4()),"timestamp":int(time.time()),
      "action":action,"commit":commit,"rollback_ref":commit,
      "details":details or {}}
