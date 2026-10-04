from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)

def test_hardware_select_api():
    r=client.post("/v1/models/select",json={"ram_gb":32,"vram_gb":12})
    assert r.status_code==200
    assert r.json()["tier"]=="strong"
    assert r.json()["local"] is True

def test_mission_api_is_plan_only():
    r=client.post("/v1/missions/plan",json={"goal":"build the next Hercules feature"})
    assert r.status_code==200
    body=r.json()
    assert body["mutation_requires_authorization"] is True
    assert body["stages"][-1]["name"]=="verify"
