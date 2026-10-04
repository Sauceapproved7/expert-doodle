from pathlib import Path


def test_mcp_exposes_read_only_installed_model_inventory():
    source=Path("hercules-ai/app/mcp_server.py").read_text()
    assert '"hercules.models.installed"' in source
    assert '"mutation_authority":False' in source
    assert 'hercules.models.pull' not in source
    assert 'hercules.models.delete' not in source
