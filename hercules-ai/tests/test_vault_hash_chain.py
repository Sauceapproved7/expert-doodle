from app.vault import append_event, verify_chain

def test_vault_hash_chain_detects_replaced_event(tmp_path):
    path=str(tmp_path/"vault.db")
    first=append_event(path,"plan","a",{"n":1})
    second=append_event(path,"verify","b",{"n":2})
    assert first["prev_hash"]==""
    assert second["prev_hash"]==first["event_hash"]
    assert verify_chain(path)["valid"] is True

def test_chain_hash_is_sha256_hex(tmp_path):
    event=append_event(str(tmp_path/"vault.db"),"build","abc")
    assert len(event["event_hash"])==64
    int(event["event_hash"],16)
