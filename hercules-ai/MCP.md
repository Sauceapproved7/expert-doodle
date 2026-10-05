# Hercules MCP

Hercules exposes its MCP server at `/mcp` using the official MCP SDK Streamable HTTP transport.

## Security model

- MCP tools are explicit allow-list entries and unknown tools fail closed.
- The public surface is deliberately read-only and non-destructive.
- Owner bearer-token authentication remains a separate owner-only path.
- Community/public bearer tokens are validated through the configured OAuth verifier and must be bound to the configured Hercules MCP resource and the fixed least-privilege `hercules.read` scope.
- Public hosting fails closed when MCP authentication is not configured.
- Transport security uses DNS-rebinding protection and an explicit production host allowlist.
- No shell, filesystem mutation, credential access, deployment, commerce mutation, account mutation, or secret-access tool is exposed through the community read-only surface.

## OAuth discovery

When configured for public OAuth, Hercules publishes protected-resource metadata at:

`/.well-known/oauth-protected-resource`

Unauthorized MCP requests advertise that metadata through the `WWW-Authenticate` response header. Protected-resource metadata advertises `hercules.read`, and every public tool advertises the same OAuth requirement through top-level `securitySchemes` plus the `_meta.securitySchemes` compatibility mirror. MCP Python 2.3.0 uses a strict `Tool` model, so Hercules adds the required top-level field at the SDK `ServerMiddleware` wire boundary after `tools/list` serialization instead of weakening or forking the protocol model. The authorization server is configured independently from the owner bearer token. Hercules remains fail-closed until that provider is configured.

## Public plugin packaging

The repository contains:

- root `plugin.json`
- root `mcp.json`
- `skills/hercules-readonly/SKILL.md`

The domain-verification challenge is served from `/.well-known/openai-apps-challenge` only when `OPENAI_APPS_CHALLENGE` is configured.

The production MCP endpoint is `https://hercules-mcp.onrender.com/mcp`. Runtime deployment evidence must be reverified against the exact canonical commit after each security-contract change. Deployment evidence does not prove OAuth-provider readiness, domain verification, directory approval, or publication; those states require separate provider and OpenAI review evidence.
