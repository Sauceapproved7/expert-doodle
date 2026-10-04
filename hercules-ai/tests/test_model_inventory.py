from pathlib import Path


def test_model_inventory_endpoint_is_read_only_and_queries_local_backend():
    source=Path("hercules-ai/app/main.py").read_text()
    assert '@app.get("/v1/models")' in source
    assert 'f"{BASE}/api/tags"' in source
    assert '"installed":models' in source
    assert '@app.post("/v1/models/pull")' not in source
