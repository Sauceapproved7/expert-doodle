import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.mcp_runtime import OAUTH_ONLY_SECURITY_SCHEMES, oauth_tool_security_middleware


def test_tools_list_wire_advertises_required_oauth_scheme():
    async def exercise():
        ctx = SimpleNamespace(method="tools/list")

        async def call_next(_ctx):
            return {
                "tools": [{
                    "name": "hercules.get_status",
                    "inputSchema": {"type": "object"},
                    "_meta": {"existing": "preserved"},
                }]
            }

        result = await oauth_tool_security_middleware(ctx, call_next)
        tool = result["tools"][0]
        assert tool["securitySchemes"] == OAUTH_ONLY_SECURITY_SCHEMES
        assert tool["_meta"]["securitySchemes"] == OAUTH_ONLY_SECURITY_SCHEMES
        assert tool["_meta"]["existing"] == "preserved"

    asyncio.run(exercise())


def test_non_tools_list_wire_is_unchanged():
    async def exercise():
        ctx = SimpleNamespace(method="resources/list")
        original = {"resources": [{"name": "x"}]}

        async def call_next(_ctx):
            return original

        assert await oauth_tool_security_middleware(ctx, call_next) == original

    asyncio.run(exercise())
