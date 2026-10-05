import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile("hercules-ai/app/main.py", "utf8");
const runtime = await readFile("hercules-ai/app/mcp_runtime.py", "utf8");

test("public MCP OAuth validates tokens through a separate configured verifier", () => {
  assert.match(source, /HERCULES_MCP_OAUTH_INTROSPECTION_URL/);
  assert.match(source, /HERCULES_MCP_OAUTH_CLIENT_ID/);
  assert.match(source, /HERCULES_MCP_OAUTH_CLIENT_SECRET/);
  assert.match(source, /async def validate_public_mcp_token/);
  assert.match(source, /"active"/);
});

test("public MCP OAuth preserves provider-specific token binding", () => {
  assert.match(runtime, /PUBLIC_MCP_SCOPES = \(\)/);
  assert.match(source, /MCP_OAUTH_REQUIRED_SCOPES=set\(PUBLIC_MCP_SCOPES\)/);
  assert.match(source, /MCP_RESOURCE/);
  assert.match(source, /MCP_OAUTH_MODE=="introspection"/);
  assert.match(source, /MCP_OAUTH_MODE=="supabase"/);
  assert.match(source, /payload\.get\("iss"\) != MCP_OAUTH_ISSUER/);
  assert.match(source, /MCP_OAUTH_AUDIENCE not in audiences/);
  assert.match(source, /not payload\.get\("client_id"\)/);
  assert.match(source, /payload\.get\("sub"\)==user\.get\("id"\)/);
});

test("owner bearer token remains a distinct fail-closed authentication path", () => {
  assert.match(source, /HERCULES_MCP_TOKEN/);
  assert.match(source, /secrets\.compare_digest/);
  assert.match(source, /validate_public_mcp_token/);
});
