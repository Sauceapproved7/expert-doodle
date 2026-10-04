import hashlib, json, sqlite3, time, uuid

def _db(path):
    c=sqlite3.connect(path)
    c.execute("""create table if not exists vault_events(
      id text primary key, created_at integer not null, action text not null,
      commit_ref text not null, rollback_ref text not null, details text not null,
      prev_hash text not null default '', event_hash text not null default '')""")
    cols={r[1] for r in c.execute("pragma table_info(vault_events)")}
    if "prev_hash" not in cols: c.execute("alter table vault_events add column prev_hash text not null default ''")
    if "event_hash" not in cols: c.execute("alter table vault_events add column event_hash text not null default ''")
    c.execute("""create trigger if not exists vault_events_no_update
      before update on vault_events begin select raise(abort,'vault_events is append-only'); end""")
    c.execute("""create trigger if not exists vault_events_no_delete
      before delete on vault_events begin select raise(abort,'vault_events is append-only'); end""")
    c.commit(); return c

def _hash(event):
    body={k:event[k] for k in ("id","created_at","action","commit","rollback_ref","details","prev_hash")}
    return hashlib.sha256(json.dumps(body,sort_keys=True,separators=(",",":")).encode()).hexdigest()

def append_event(path,action,commit,details=None):
    if not action or not commit: raise ValueError("action and commit are required")
    with _db(path) as c:
        row=c.execute("select event_hash from vault_events order by rowid desc limit 1").fetchone()
        event={"id":str(uuid.uuid4()),"created_at":int(time.time()),"action":action,
               "commit":commit,"rollback_ref":commit,"details":details or {},"prev_hash":row[0] if row else ""}
        event["event_hash"]=_hash(event)
        c.execute("insert into vault_events(id,created_at,action,commit_ref,rollback_ref,details,prev_hash,event_hash) values(?,?,?,?,?,?,?,?)",
          (event["id"],event["created_at"],event["action"],event["commit"],event["rollback_ref"],json.dumps(event["details"],sort_keys=True),event["prev_hash"],event["event_hash"]))
    return event

def list_events(path,limit=100):
    limit=max(1,min(int(limit),500))
    with _db(path) as c:
        rows=c.execute("select id,created_at,action,commit_ref,rollback_ref,details,prev_hash,event_hash from vault_events order by created_at desc,rowid desc limit ?",(limit,)).fetchall()
    return [{"id":i,"created_at":t,"action":a,"commit":cm,"rollback_ref":rb,"details":json.loads(d),"prev_hash":ph,"event_hash":eh} for i,t,a,cm,rb,d,ph,eh in rows]

def verify_chain(path):
    with _db(path) as c:
        rows=c.execute("select id,created_at,action,commit_ref,rollback_ref,details,prev_hash,event_hash from vault_events order by rowid").fetchall()
    previous=""
    for i,t,a,cm,rb,d,ph,eh in rows:
        event={"id":i,"created_at":t,"action":a,"commit":cm,"rollback_ref":rb,"details":json.loads(d),"prev_hash":ph}
        if ph!=previous or not eh or _hash(event)!=eh:
            return {"valid":False,"events":len(rows),"failed_event_id":i}
        previous=eh
    return {"valid":True,"events":len(rows),"head_hash":previous}
