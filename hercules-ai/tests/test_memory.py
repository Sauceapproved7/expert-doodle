from app.memory import MemoryStore

def test_memory_store_round_trip(tmp_path):
    store=MemoryStore(str(tmp_path/"memory.db"))
    mid=store.remember("SauceApproved uses Hercules for local-first AI", tags=["business","ai"])
    hits=store.search("local first", limit=5)
    assert hits and hits[0]["id"]==mid
    assert "Hercules" in hits[0]["content"]

def test_memory_search_is_bounded(tmp_path):
    store=MemoryStore(str(tmp_path/"memory.db"))
    for i in range(10):
        store.remember(f"note {i} alpha")
    assert len(store.search("alpha", limit=3))==3
