# Hercules MCP

Hercules includes its own MCP-compatible JSON-RPC tool server at `POST /mcp`.

## Security model
- Tools are explicit allow-list entries.
- Unknown tools fail closed.
- v1 exposes read-only status plus an echo connectivity tool.
- No shell, filesystem mutation, credential access, network pivot, deployment, commerce, or account mutation tool is implicitly available.
- Future adapters must be added explicitly and can enforce separate authorization/consent.

## Methods
- `initialize`
- `ping`
- `tools/list`
- `tools/call`

Example request:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```
