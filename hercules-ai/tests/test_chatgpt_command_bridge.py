from pathlib import Path

SRC = Path("hercules-ai/app/mcp_server.py").read_text()


def test_chatgpt_bridge_exposes_read_only_command_surface():
    required = [
        '"hercules.command.status"',
        '"hercules.command.mission"',
        '"hercules.command.vault"',
        '"hercules.command.models"',
        '"hercules.command.verify"',
    ]
    for tool in required:
        assert tool in SRC


def test_chatgpt_bridge_has_no_mutating_command():
    forbidden = [
        '"hercules.command.deploy"',
        '"hercules.command.execute"',
        '"hercules.command.delete"',
        '"hercules.command.write"',
    ]
    for tool in forbidden:
        assert tool not in SRC


def test_chatgpt_bridge_routes_commands_to_existing_safe_capabilities():
    assert 'if name=="hercules.command.status"' in SRC
    assert 'if name=="hercules.command.mission"' in SRC
    assert 'if name=="hercules.command.vault"' in SRC
    assert 'if name=="hercules.command.models"' in SRC
    assert 'if name=="hercules.command.verify"' in SRC
    assert '"mutation_authority":False' in SRC
