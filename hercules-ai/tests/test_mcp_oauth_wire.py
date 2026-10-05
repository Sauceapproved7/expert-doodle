import asyncio
from types import SimpleNamespace

from app.mcp_runtime import OAUTH_ONLY_SECURITY_SCHEMES, oauth_tool_security_middleware


def test_tools_list_middleware_injects_top_level_and_meta_security_schemes():
    async def exercise():
        ctx = SimpleNamespace(method="tools/list")

        async def call_next(_ctx):
            return {
                "tools": [
                    {
                        "name": "hercules.get_status",
                        "description": "status",
                        "inputSchema": {"type": "object"},
                        "_meta": {"existing": "preserved"},
                    }
                ]
            }

        result = await oauth_tool_security_middleware(ctx, call_next)
        tool = result["tools"][0]
        assert tool["securitySchemes"] == OAUTH_ONLY_SECURITY_SCHEMES
        assert tool["_meta"]["securitySchemes"] == OAUTH_ONLY_SECURITY_SCHEMES
        assert tool["_meta"]["existing"] == "preserved"

    asyncio.run(exercise())


def test_non_tool_results_are_not_mutated():
    async def exercise():
        ctx = SimpleNamespace(method="resources/list")
        original = {"resources": [{"name": "x"}]}

        async def call_next(_ctx):
            return original

        result = await oauth_tool_security_middleware(ctx, call_next)
        assert result == original

    asyncio.run(exercise())
