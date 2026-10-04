import os

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

from .mcp_server import call_tool


hercules_mcp = MCPServer(
    "hercules-mcp",
    version="1.1.0",
    instructions="Bounded read-only Hercules status, planning, model, and Vault verification tools.",
)

READ_ONLY_CLOSED_WORLD = ToolAnnotations(
    read_only_hint=True,
    destructive_hint=False,
    idempotent_hint=True,
    open_world_hint=False,
)


def transport_security() -> TransportSecuritySettings | None:
    raw = os.getenv("HERCULES_MCP_ALLOWED_HOSTS", "").strip()
    if not raw:
        # Let the SDK apply its localhost-only default. Production hosts remain
        # unreachable until an explicit allowlist is configured.
        return None
    hosts = [value.strip() for value in raw.split(",") if value.strip()]
    if not hosts:
        return None
    origins = [
        value.strip()
        for value in os.getenv("HERCULES_MCP_ALLOWED_ORIGINS", "").split(",")
        if value.strip()
    ]
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=hosts,
        allowed_origins=origins,
    )


def _text(name: str, arguments: dict) -> str:
    result = call_tool(name, arguments)
    return result["content"][0]["text"]


@hercules_mcp.tool(
    name="hercules.command.status",
    description="Read-only Hercules runtime status.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_status() -> str:
    return _text("hercules.command.status", {})


@hercules_mcp.tool(
    name="hercules.command.mission",
    description="Create a non-executing Hercules mission plan.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_mission(goal: str) -> str:
    return _text("hercules.command.mission", {"goal": goal})


@hercules_mcp.tool(
    name="hercules.command.vault",
    description="Read-only Hercules Vault status and recent events.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_vault(limit: int = 25) -> str:
    return _text("hercules.command.vault", {"limit": limit})


@hercules_mcp.tool(
    name="hercules.command.models",
    description="Read-only inventory of installed Hercules models.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_models() -> str:
    return _text("hercules.command.models", {})


@hercules_mcp.tool(
    name="hercules.command.verify",
    description="Verify the Hercules Vault hash chain without mutation.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_verify() -> str:
    return _text("hercules.command.verify", {})
