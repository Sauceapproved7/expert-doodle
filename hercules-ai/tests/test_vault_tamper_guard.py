import sqlite3
import pytest
from app.vault import append_event

def test_vault_rejects_update_and_delete(tmp_path):
    path=str(tmp_path/"vault.db")
    event=append_event(path,"plan","abc123",{"goal":"ship"})
    with sqlite3.connect(path) as c:
        with pytest.raises(sqlite3.DatabaseError):
            c.execute("update vault_events set action='tampered' where id=?",(event["id"],))
        with pytest.raises(sqlite3.DatabaseError):
            c.execute("delete from vault_events where id=?",(event["id"],))
        row=c.execute("select action from vault_events where id=?",(event["id"],)).fetchone()
        assert row==("plan",)
