import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(new URL("../supabase/functions/hercules-domains/index.ts",import.meta.url),"utf8");

test("domain_control_center is a read-only action composed from production status",()=>{
  assert.match(edge,/action==='domain_control_center'/);
  assert.match(edge,/buildDomainControlCenter/);
  const block=edge.slice(edge.indexOf("if(action==='domain_control_center')"),edge.indexOf("if(action==='production_reconcile')"));
  assert.match(block,/productionStatus\(db,org\)/);
  assert.doesNotMatch(block,/rpc\(/);
  assert.doesNotMatch(block,/insert\(/);
  assert.doesNotMatch(block,/update\(/);
});
