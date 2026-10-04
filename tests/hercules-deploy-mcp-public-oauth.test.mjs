import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile("hercules-ai/app/main.py", "utf8");

test("public MCP OAuth validates tokens through a separate configured verifier", () => {
  assert.match(source, /HERCULES_MCP_OAUTH_INTROSPECTION_URL/);
  assert.match(source, /HERCULES_MCP_OAUTH_CLIENT_ID/);
  assert.match(source, /HERCULES_MCP_OAUTH_CLIENT_SECRET/);
  assert.match(source, /async def validate_public_mcp_token/);
  assert.match(source, /"active"/);
});

test("public MCP OAuth binds accepted tokens to the configured resource and scopes", () => {
  assert.match(source, /HERCULES_MCP_OAUTH_REQUIRED_SCOPES/);
  assert.match(source, /MCP_RESOURCE/);
  assert.match(source, /"aud"/);
  assert.match(source, /"scope"/);
});

test("owner bearer token remains a distinct fail-closed authentication path", () => {
  assert.match(source, /HERCULES_MCP_TOKEN/);
  assert.match(source, /secrets\.compare_digest/);
  assert.match(source, /validate_public_mcp_token/);
});
