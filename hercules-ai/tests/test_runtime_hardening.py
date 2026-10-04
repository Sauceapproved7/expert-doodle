from pathlib import Path

def test_api_binds_loopback_by_default():
    compose=Path("hercules-ai/docker-compose.yml").read_text()
    assert '127.0.0.1:8080:8080' in compose

def test_api_container_drops_privileges():
    compose=Path("hercules-ai/docker-compose.yml").read_text()
    assert "no-new-privileges:true" in compose
    assert "cap_drop:" in compose
    assert "- ALL" in compose
