import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

test("Performance Brain surface exposes governed Campaign Forge review workflow",async()=>{
 const response=await createStudioHttpHandler()({method:"GET",pathname:"/performance-brain"});
 assert.equal(response.status,200);
 assert.match(response.body,/Campaign Forge evidence/i);
 assert.match(response.body,/Evaluate verified evidence/i);
 assert.match(response.body,/\/api\/studio\/performance-brain\/evaluate/);
 assert.match(response.body,/Review required/i);
 assert.match(response.body,/No auto-publish/);
 assert.match(response.body,/No auto-spend/);
});
