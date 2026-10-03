import test from "node:test";
import assert from "node:assert/strict";
import {createSnapshot,restoreSnapshot,createReview,addReviewComment,decideReview} from "./time-review.mjs";

test("Time Machine snapshot records project version and immutable evidence digest input",()=>{
 const s=createSnapshot({projectId:"p1",projectVersion:7,label:"Before client notes",state:{assetIds:["a1"],timelineVersion:4}});
 assert.equal(s.projectVersion,7); assert.equal(s.label,"Before client notes"); assert.equal(s.restoreMode,"copy-forward");
});
test("Time Machine restore is copy-forward and never rewrites history",()=>{
 const r=restoreSnapshot({currentVersion:8,snapshot:{projectId:"p1",projectVersion:7,state:{timelineVersion:4}}});
 assert.equal(r.newVersion,9); assert.equal(r.restoredFromVersion,7); assert.equal(r.state.timelineVersion,4);
});
test("Review Room stores timestamped comments against a project version",()=>{
 let review=createReview({id:"r1",projectId:"p1",projectVersion:9,reviewerId:"client-1"});
 review=addReviewComment(review,{id:"c1",atMs:4200,text:"Hold this shot longer"});
 assert.equal(review.comments[0].atMs,4200); assert.equal(review.status,"open");
});
test("Review decision requires explicit reviewer identity",()=>{
 const review=createReview({id:"r1",projectId:"p1",projectVersion:9,reviewerId:"client-1"});
 assert.throws(()=>decideReview(review,{decision:"approved",by:""}),/review_decision_identity_required/);
 const done=decideReview(review,{decision:"approved",by:"client-1"});
 assert.equal(done.status,"approved");
});
