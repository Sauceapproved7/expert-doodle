from pathlib import Path

def test_local_deployment_has_healthcheck_and_model_persistence():
    compose=Path("hercules-ai/docker-compose.yml").read_text()
    api=compose.split("  ollama:",1)[0]
    ollama=compose.split("  ollama:",1)[1]
    assert "healthcheck:" in api
    assert 'http://127.0.0.1:8080/health' in api
    assert "healthcheck:" in ollama
    assert "ollama-data:/root/.ollama" in ollama
