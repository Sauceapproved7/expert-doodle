import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

test("Release Truth Room is a human-readable fail-closed Studio surface",async()=>{
 const handle=createStudioHttpHandler();
 const page=await handle({method:"GET",pathname:"/release-truth"});
 assert.equal(page.status,200);
 assert.match(page.body,/Release Truth Room/);
 assert.match(page.body,/Release blocked/i);
 assert.match(page.body,/Synthetic evidence.*not allowed/i);
 assert.match(page.body,/owner-controlled/i);
});
