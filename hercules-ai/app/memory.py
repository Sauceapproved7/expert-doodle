import json, sqlite3, time, uuid, re

class MemoryStore:
    def __init__(self,path):
        self.path=path
        self._init()

    def _conn(self):
        return sqlite3.connect(self.path)

    def _init(self):
        c=self._conn()
        c.execute("""create table if not exists memories(
          id text primary key, content text not null, tags text not null,
          created_at integer not null)""")
        c.commit(); c.close()

    def remember(self,content,tags=None):
        if not isinstance(content,str) or not content.strip():
            raise ValueError("content required")
        mid=str(uuid.uuid4())
        c=self._conn()
        c.execute("insert into memories values(?,?,?,?)",
                  (mid,content.strip(),json.dumps(tags or []),int(time.time())))
        c.commit(); c.close()
        return mid

    def search(self,query,limit=10):
        limit=max(1,min(int(limit),50))
        terms=[t for t in re.findall(r"[a-z0-9]+",query.lower()) if len(t)>1]
        c=self._conn()
        rows=c.execute("select id,content,tags,created_at from memories order by created_at desc").fetchall()
        c.close()
        scored=[]
        for mid,content,tags,created in rows:
            hay=content.lower()
            score=sum(hay.count(t) for t in terms)
            if not terms or score:
                scored.append((score,created,{"id":mid,"content":content,"tags":json.loads(tags),"created_at":created}))
        scored.sort(key=lambda x:(x[0],x[1]),reverse=True)
        return [item for _,_,item in scored[:limit]]
