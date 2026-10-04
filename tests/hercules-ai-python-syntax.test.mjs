import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

test("Hercules AI main module is Python syntax-valid after OAuth configuration changes", async()=>{
  const source=await readFile("hercules-ai/app/main.py","utf8");
  assert.doesNotMatch(source,/\\\\nMCP_OAUTH_/,"OAuth configuration must contain real newlines, not literal \\n text");
  const result=spawnSync("python",["-m","py_compile","hercules-ai/app/main.py"],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
