import test from "node:test";
import assert from "node:assert/strict";
import {createMissionEngine} from "../hercules-bot/mission-engine.mjs";

test("mission adapter preserves ordered execution evidence",async()=>{
 const seen=[];const e=createMissionEngine({executor:async s=>{seen.push(s.verb);return {ok:true}}});
 const p=await e.plan("inspect the vault and check the system");
 const r=await e.execute(p);
 assert.deepEqual(seen,["inspect","status"]);assert.equal(r.receipts.length,2);
});
