import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path("hercules-ai").resolve()))

from app.mcp_runtime import PUBLIC_MCP_SCOPES, hercules_mcp


def test_live_sdk_tool_descriptors_advertise_oauth_compatibility_metadata():
    tools = asyncio.run(hercules_mcp.list_tools())

    assert len(tools) == 5
    expected = [{"type": "oauth2", "scopes": list(PUBLIC_MCP_SCOPES)}]
    for tool in tools:
        descriptor = tool.model_dump(by_alias=True, exclude_none=True)
        assert descriptor["_meta"]["securitySchemes"] == expected
        assert descriptor["annotations"]["readOnlyHint"] is True
        assert descriptor["annotations"]["destructiveHint"] is False
        assert descriptor["annotations"]["openWorldHint"] is False
