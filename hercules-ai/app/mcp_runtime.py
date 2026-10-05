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


def effective_allowed_hosts() -> list[str]:
    raw = os.getenv("HERCULES_MCP_ALLOWED_HOSTS", "").strip()
    if raw:
        return [value.strip() for value in raw.split(",") if value.strip()]
    render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
    return [render_host] if render_host else []


def transport_security() -> TransportSecuritySettings | None:
    hosts = effective_allowed_hosts()
    if not hosts:
        # Let the SDK apply its localhost-only default when neither an explicit
        # allowlist nor the provider-supplied Render hostname is available.
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
    name="hercules.get_status",
    title="Get Hercules status",
    description="Use when the user asks whether Hercules is running or wants its current service status. Returns a bounded read-only summary and never changes Hercules state.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_status() -> str:
    return _text("hercules.command.status", {})


@hercules_mcp.tool(
    name="hercules.plan_mission",
    title="Plan Hercules mission",
    description="Use when the user asks Hercules to plan a goal without executing it. Returns a non-executing staged plan and never deploys or changes state.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_mission(goal: str) -> str:
    return _text("hercules.command.mission", {"goal": goal})


@hercules_mcp.tool(
    name="hercules.get_vault_summary",
    title="Get Hercules Vault summary",
    description="Use when the user asks about Hercules Vault health or recent activity. Returns a minimized summary and recent action names; it never returns raw event records or changes Vault state.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_vault(limit: int = 25) -> str:
    return _text("hercules.command.vault", {"limit": limit})


@hercules_mcp.tool(
    name="hercules.list_models",
    title="List Hercules models",
    description="Use when the user asks which models Hercules currently reports as installed. Returns model name and size only; if the inventory backend is unavailable, returns an explicit unavailable empty result and never changes model state.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_models() -> str:
    return _text("hercules.command.models", {})


@hercules_mcp.tool(
    name="hercules.verify_vault",
    title="Verify Hercules Vault",
    description="Use when the user asks to verify Hercules Vault evidence integrity. Returns validity and event count only and never returns raw hashes or changes Vault state.",
    annotations=READ_ONLY_CLOSED_WORLD,
)
def command_verify() -> str:
    return _text("hercules.command.verify", {})
