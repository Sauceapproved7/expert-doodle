from pathlib import Path

def test_api_container_uses_read_only_root_and_tmpfs():
    compose=Path("hercules-ai/docker-compose.yml").read_text()
    api=compose.split("  ollama:",1)[0]
    assert "read_only: true" in api
    assert "tmpfs:" in api
    assert "- /tmp" in api
    assert "HERCULES_VAULT_DB: /data/hercules-vault.db" in api
