import json, sqlite3, time, uuid

def _db(path):
    c=sqlite3.connect(path)
    c.execute("""create table if not exists vault_events(
      id text primary key, created_at integer not null, action text not null,
      commit_ref text not null, rollback_ref text not null, details text not null)""")
    c.commit(); return c

def append_event(path,action,commit,details=None):
    if not action or not commit: raise ValueError("action and commit are required")
    event={"id":str(uuid.uuid4()),"created_at":int(time.time()),"action":action,
           "commit":commit,"rollback_ref":commit,"details":details or {}}
    with _db(path) as c:
        c.execute("insert into vault_events values(?,?,?,?,?,?)",
          (event["id"],event["created_at"],event["action"],event["commit"],event["rollback_ref"],json.dumps(event["details"],sort_keys=True)))
    return event

def list_events(path,limit=100):
    limit=max(1,min(int(limit),500))
    with _db(path) as c:
        rows=c.execute("select id,created_at,action,commit_ref,rollback_ref,details from vault_events order by created_at desc,rowid desc limit ?",(limit,)).fetchall()
    return [{"id":i,"created_at":t,"action":a,"commit":cm,"rollback_ref":rb,"details":json.loads(d)} for i,t,a,cm,rb,d in rows]
