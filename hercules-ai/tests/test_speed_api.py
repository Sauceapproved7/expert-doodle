from fastapi.testclient import TestClient
from app.main import app

client=TestClient(app)

def test_speed_profile_endpoint():
    r=client.get("/v1/speed/deep")
    assert r.status_code==200
    assert r.json()["mode"]=="deep"

def test_chat_accepts_speed_mode_shape():
    schema=app.openapi()["components"]["schemas"]["ChatRequest"]["properties"]
    assert "speed_mode" in schema
