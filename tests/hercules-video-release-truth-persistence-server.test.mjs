import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

test("Studio Release Truth status reads injected ledger evidence without exposing mutation",async()=>{
 const backing=[];
 const handle=createStudioHttpHandler({releaseTruthBacking:backing});
 const response=await handle({method:"GET",pathname:"/api/studio/release-truth/status"});
 assert.equal(response.status,200);
 const body=JSON.parse(response.body);
 assert.equal(body.releaseReady,false);
 assert.equal(body.syntheticEvidenceAllowed,false);
 const denied=await handle({method:"POST",pathname:"/api/studio/release-truth/evidence"});
 assert.equal(denied.status,404);
});
