import test from "node:test";
import assert from "node:assert/strict";
import {createStudioServer} from "../hercules-video/studio-server.mjs";

test("Studio release truth status is public-readable and fails closed without evidence",async()=>{
 const studio=createStudioServer();
 const response=await studio.handle({method:"GET",pathname:"/api/studio/release-truth/status"});
 assert.equal(response.status,200);
 const body=JSON.parse(response.body);
 assert.equal(body.releaseReady,false);
 assert.equal(body.syntheticEvidenceAllowed,false);
 assert.ok(body.blockedSystemIds.length>0);
});
