from pathlib import Path


def test_installed_model_tool_has_runtime_handler_and_valid_source():
    source = Path("hercules-ai/app/mcp_server.py").read_text()
    compile(source, "hercules-ai/app/mcp_server.py", "exec")
    assert 'if name=="hercules.models.installed":' in source
    assert 'mutation_authority' in source
    assert 'urlopen' in source
    assert 'hercules.models.pull' not in source
    assert 'hercules.models.delete' not in source
