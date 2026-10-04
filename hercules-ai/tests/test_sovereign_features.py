from app.sovereign import choose_model, mission_plan, vault_event

def test_model_arsenal_selects_by_hardware():
    assert choose_model({"ram_gb":8,"vram_gb":0})["tier"]=="compact"
    assert choose_model({"ram_gb":32,"vram_gb":12})["tier"]=="strong"

def test_mission_commander_builds_gated_pipeline():
    p=mission_plan("ship feature")
    assert [x["name"] for x in p["stages"]]==["plan","build","test","security","deploy","verify"]
    assert p["mutation_requires_authorization"] is True

def test_black_box_event_is_auditable():
    e=vault_event("deploy","abc123",{"target":"local"})
    assert e["action"]=="deploy"
    assert e["commit"]=="abc123"
    assert e["rollback_ref"]=="abc123"
