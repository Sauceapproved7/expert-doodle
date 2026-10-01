import test from "node:test";
import assert from "node:assert/strict";
import {createTimeline,addClip,createExportJob} from "./timeline-export.mjs";

test("Timeline Editor builds non-destructive tracks and clips",()=>{
 let t=createTimeline({projectId:"p1"});
 t=addClip(t,{id:"c1",assetId:"a1",track:"video-1",startMs:0,inMs:1000,outMs:6000});
 assert.equal(t.durationMs,5000); assert.equal(t.tracks[0].clips[0].source.inMs,1000);
});

test("Timeline Editor rejects invalid source ranges",()=>{
 const t=createTimeline({projectId:"p1"});
 assert.throws(()=>addClip(t,{id:"c1",assetId:"a1",track:"video-1",startMs:0,inMs:6000,outMs:1000}),/invalid_clip_range/);
});

test("Export Center stays fail-closed without verified renderer and project approval",()=>{
 const job=createExportJob({projectId:"p1",timelineVersion:2,preset:"vertical-1080x1920",renderer:{verified:false},approval:{approved:false}});
 assert.equal(job.state,"blocked"); assert.deepEqual(job.blockers,["verified_renderer_required","project_export_approval_required"]);
});

test("Export Center emits proof receipt skeleton when gates are satisfied",()=>{
 const job=createExportJob({projectId:"p1",timelineVersion:2,preset:"vertical-1080x1920",renderer:{id:"r1",verified:true},approval:{approved:true,by:"owner-1"}});
 assert.equal(job.state,"ready"); assert.equal(job.proofReceipt.projectId,"p1"); assert.equal(job.proofReceipt.timelineVersion,2);
});
