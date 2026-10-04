from pathlib import Path
import sqlite3
from app import main

def test_compose_binds_api_to_loopback_and_drops_caps():
    compose=Path("hercules-ai/docker-compose.yml").read_text()
    assert '"127.0.0.1:8080:8080"' in compose
    assert "no-new-privileges:true" in compose
    assert "cap_drop:" in compose and "- ALL" in compose

def test_conversation_schema_has_explicit_sequence(tmp_path, monkeypatch):
    monkeypatch.setattr(main,"DB",str(tmp_path/"h.db"))
    conn=main.db()
    cols={row[1] for row in conn.execute("pragma table_info(messages)").fetchall()}
    conn.close()
    assert "sequence" in cols
