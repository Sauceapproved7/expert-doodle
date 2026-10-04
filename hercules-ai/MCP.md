# Hercules MCP

Hercules exposes its MCP server at `/mcp` using the official MCP SDK Streamable HTTP transport.

## Security model

- MCP tools are explicit allow-list entries and unknown tools fail closed.
- The public surface is deliberately read-only and non-destructive.
- Owner bearer-token authentication remains a separate owner-only path.
- Community/public bearer tokens are validated through the configured OAuth verifier and must be bound to the configured Hercules MCP resource and required scopes.
- Public hosting fails closed when MCP authentication is not configured.
- Transport security uses DNS-rebinding protection and an explicit production host allowlist.
- No shell, filesystem mutation, credential access, deployment, commerce mutation, account mutation, or secret-access tool is exposed through the community read-only surface.

## OAuth discovery

When configured for public OAuth, Hercules publishes protected-resource metadata at:

`/.well-known/oauth-protected-resource`

Unauthorized MCP requests advertise that metadata through the `WWW-Authenticate` response header. The authorization server is configured independently from the owner bearer token.

## Public plugin packaging

The repository contains:

- root `plugin.json`
- root `mcp.json`
- `skills/hercules-readonly/SKILL.md`

The domain-verification challenge is served from `/.well-known/openai-apps-challenge` only when `OPENAI_APPS_CHALLENGE` is configured.

The existing public MCP endpoint has current Render deployment evidence for canonical commit `fa35c81808fb74b41bd3d6e4c5d5dd60cdd20786`. Deployment evidence does not prove directory approval or publication; those states still require separate OpenAI directory-review evidence.
