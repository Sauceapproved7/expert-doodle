import test from "node:test";
import assert from "node:assert/strict";
import {createPublishPlan,authorizeDestination,approvePublishPlan,evaluatePublishPlan,ingestPerformanceEvidence,buildPerformanceRecommendations} from "./publish-feedback.mjs";

test("Publishing Command Center starts blocked and destination-neutral",()=>{
 const p=createPublishPlan({projectId:"p1",exportReceiptId:"e1",destinations:["youtube","instagram"]});
 assert.equal(evaluatePublishPlan(p).state,"blocked");
 assert.deepEqual(evaluatePublishPlan(p).blockers,["destination_authorization_required:youtube","destination_authorization_required:instagram","final_publish_approval_required"]);
});
test("publishing requires explicit authorization and final approval",()=>{
 let p=createPublishPlan({projectId:"p1",exportReceiptId:"e1",destinations:["youtube"]});
 p=authorizeDestination(p,{destination:"youtube",connectionId:"conn-1",verified:true});
 p=approvePublishPlan(p,{by:"owner-1"});
 assert.equal(evaluatePublishPlan(p).state,"ready");
});
test("performance evidence requires verified source and preserves metric provenance",()=>{
 const e=ingestPerformanceEvidence({projectId:"p1",source:{id:"yt-analytics",verified:true},metrics:{views:1200,retention:0.61}});
 assert.equal(e.metrics.views,1200); assert.equal(e.proofSpine.sourceId,"yt-analytics");
});
test("feedback produces recommendations without mutating Brand Brain",()=>{
 const e=ingestPerformanceEvidence({projectId:"p1",source:{id:"yt-analytics",verified:true},metrics:{views:1200,retention:0.61}});
 const r=buildPerformanceRecommendations(e,{brandBrainVersion:12});
 assert.equal(r.brandBrainVersion,12); assert.equal(r.brandMutationAllowed,false); assert.equal(r.state,"recommendations-only");
});
