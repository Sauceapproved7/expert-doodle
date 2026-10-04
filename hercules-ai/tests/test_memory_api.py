from fastapi.testclient import TestClient
from app import main

client=TestClient(main.app)

def test_memory_api_store_and_search(tmp_path, monkeypatch):
    monkeypatch.setattr(main,"MEMORY_DB",str(tmp_path/"mem.db"))
    r=client.post("/v1/memory",json={"content":"Hercules black box vault","tags":["vault"]})
    assert r.status_code==200
    s=client.get("/v1/memory/search",params={"q":"black box"})
    assert s.status_code==200
    assert s.json()["items"][0]["content"]=="Hercules black box vault"
