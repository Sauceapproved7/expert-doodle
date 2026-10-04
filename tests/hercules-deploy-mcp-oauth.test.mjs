import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile("hercules-ai/app/main.py", "utf8");

test("public MCP publishes OAuth protected-resource discovery metadata", () => {
  assert.match(source, /HERCULES_MCP_RESOURCE/);
  assert.match(source, /HERCULES_MCP_AUTHORIZATION_SERVER/);
  assert.match(source, /\/\.well-known\/oauth-protected-resource/);
  assert.match(source, /"resource": MCP_RESOURCE/);
  assert.match(source, /"authorization_servers": \[MCP_AUTHORIZATION_SERVER\]/);
});

test("unauthorized MCP challenge points clients to protected-resource metadata", () => {
  assert.match(source, /WWW-Authenticate/);
  assert.match(source, /resource_metadata=/);
  assert.match(source, /\/\.well-known\/oauth-protected-resource/);
});
