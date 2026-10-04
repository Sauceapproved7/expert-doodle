import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Hercules MCP Python source contains real OAuth configuration lines, not escaped newline text", async () => {
  const source = await readFile(new URL("../hercules-ai/app/main.py", import.meta.url), "utf8");
  assert.equal(source.includes('strip()\\\\nMCP_OAUTH_INTROSPECTION_URL'), false);
  assert.match(source, /MCP_AUTHORIZATION_SERVER=.*\.strip\(\)\nMCP_OAUTH_INTROSPECTION_URL=/);
});
