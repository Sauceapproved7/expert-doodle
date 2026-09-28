import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const policy=JSON.parse(await readFile(
  new URL("../governance/owner-code-policy.json",import.meta.url),
  "utf8"
));

test("AEGIS is an enforced owner-code runtime root",()=>{
  const aegis=policy.runtimeRoots.find((entry)=>entry.path==="hercules-aegis");
  assert.ok(aegis,"hercules-aegis must be covered by owner-code enforcement");
  assert.equal(aegis.role,"defensive-security-runtime");
});
