from pathlib import Path


def test_mcp_pydantic_dependency_is_compatible():
    requirements = Path("hercules-ai/requirements.txt").read_text()

    assert "mcp==2.3.0" in requirements
    assert "pydantic==2.12.0" in requirements
