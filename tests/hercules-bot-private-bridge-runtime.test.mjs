import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const bridge=readFileSync(resolve(root,"supabase/functions/hercules-private-bridge/index.ts"),"utf8");
const runtime=readFileSync(resolve(root,"supabase/functions/hercules-private-bridge/bot-runtime.ts"),"utf8");

test("private bridge routes isolated bot runtime requests",()=>{
  assert.match(bridge,/isBotRuntimeRequest/);
  assert.match(bridge,/handleBotRuntimeRequest/);
  assert.match(runtime,/browser-gateway/);
  assert.match(runtime,/productionDeployMutation:false/);
});

test("bot runtime exposes browser and read-only deploy status",()=>{
  assert.match(runtime,/browser\.navigate/);
  assert.match(runtime,/browser\.scrape/);
  assert.match(runtime,/deploy\.status/);
});
