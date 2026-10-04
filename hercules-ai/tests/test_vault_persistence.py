import sqlite3
from app.vault import append_event, list_events

def test_vault_persists_append_only_events(tmp_path):
    path=str(tmp_path/"vault.db")
    first=append_event(path,"plan","abc123",{"goal":"ship"})
    second=append_event(path,"verify","def456",{"ok":True})
    events=list_events(path,limit=10)
    assert [e["id"] for e in events]==[second["id"],first["id"]]
    assert events[1]["rollback_ref"]=="abc123"
    with sqlite3.connect(path) as c:
        assert c.execute("select count(*) from vault_events").fetchone()[0]==2

def test_vault_limit_is_bounded(tmp_path):
    path=str(tmp_path/"vault.db")
    for i in range(3): append_event(path,"test",str(i))
    assert len(list_events(path,limit=2))==2
