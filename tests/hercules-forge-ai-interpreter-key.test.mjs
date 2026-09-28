import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Hercules AI grants Forge a dedicated least-privilege interpreter credential", async () => {
  const source = await readFile(
    new URL("../supabase/functions/hercules-ai/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /forge-interpreter/);
  assert.match(source, /agent-coordinator/);
  assert.match(source, /x-hercules-internal-key/);
  assert.match(source, /action\|\|''\)===['"]route_internal['"]/);
  assert.match(source, /internalAuthorized\(req/);
  assert.doesNotMatch(source, /FORGE_CONTROL_TOKEN/);
  assert.doesNotMatch(source, /forge-production-control/);
});
