from app.mcp_server import list_tools, call_tool

def test_sovereign_read_only_tools_are_allowlisted():
    names={x["name"] for x in list_tools()}
    assert {"hercules.sovereign.status","hercules.models.recommend","hercules.mission.plan"} <= names

def test_model_recommendation_is_read_only():
    out=call_tool("hercules.models.recommend",{"ram_gb":32,"vram_gb":12})
    assert "strong" in out["content"][0]["text"]

def test_mission_plan_never_grants_mutation_authority():
    out=call_tool("hercules.mission.plan",{"goal":"ship feature"})
    text=out["content"][0]["text"]
    assert '"mutation_requires_authorization": true' in text
