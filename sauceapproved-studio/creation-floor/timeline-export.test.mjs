import test from "node:test";
import assert from "node:assert/strict";
import {createTimeline,addClip,moveClip,trimClip,splitClip,removeClip,createExportJob} from "./timeline-export.mjs";

test("Timeline Editor builds non-destructive tracks and clips",()=>{
 let t=createTimeline({projectId:"p1"});
 t=addClip(t,{id:"c1",assetId:"a1",track:"video-1",startMs:0,inMs:1000,outMs:6000});
 assert.equal(t.durationMs,5000); assert.equal(t.tracks[0].clips[0].source.inMs,1000);
});
test("Timeline Editor rejects invalid source ranges",()=>{
 const t=createTimeline({projectId:"p1"});
 assert.throws(()=>addClip(t,{id:"c1",assetId:"a1",track:"video-1",startMs:0,inMs:6000,outMs:1000}),/invalid_clip_range/);
});
test("Timeline Editor moves and trims clips non-destructively",()=>{
 let t=addClip(createTimeline({projectId:"p1"}),{id:"c1",assetId:"a1",track:"video-1",startMs:0,inMs:1000,outMs:6000});
 t=moveClip(t,{clipId:"c1",track:"video-2",startMs:2000});
 t=trimClip(t,{clipId:"c1",inMs:1500,outMs:5000});
 const c=t.tracks.find(x=>x.id==="video-2").clips[0];
 assert.equal(c.startMs,2000); assert.deepEqual(c.source,{inMs:1500,outMs:5000}); assert.equal(c.nonDestructive,true);
});
test("Timeline Editor splits a clip while preserving source provenance",()=>{
 let t=addClip(createTimeline({projectId:"p1"}),{id:"c1",assetId:"a1",track:"video-1",startMs:1000,inMs:0,outMs:8000});
 t=splitClip(t,{clipId:"c1",atMs:4000,leftId:"c1a",rightId:"c1b"});
 const clips=t.tracks[0].clips;
 assert.deepEqual(clips.map(x=>x.id),["c1a","c1b"]);
 assert.deepEqual(clips.map(x=>x.source),[{inMs:0,outMs:3000},{inMs:3000,outMs:8000}]);
 assert.deepEqual(clips.map(x=>x.startMs),[1000,4000]);
});
test("Timeline Editor removes clips and recomputes duration",()=>{
 let t=createTimeline({projectId:"p1"});
 t=addClip(t,{id:"c1",assetId:"a1",track:"v",startMs:0,inMs:0,outMs:9000});
 t=addClip(t,{id:"c2",assetId:"a2",track:"v",startMs:1000,inMs:0,outMs:2000});
 t=removeClip(t,{clipId:"c1"});
 assert.equal(t.durationMs,3000); assert.deepEqual(t.tracks[0].clips.map(x=>x.id),["c2"]);
});
test("Export Center stays fail-closed without verified renderer and project approval",()=>{
 const job=createExportJob({projectId:"p1",timelineVersion:2,preset:"vertical-1080x1920",renderer:{verified:false},approval:{approved:false}});
 assert.equal(job.state,"blocked"); assert.deepEqual(job.blockers,["verified_renderer_required","project_export_approval_required"]);
});
test("Export Center emits proof receipt skeleton when gates are satisfied",()=>{
 const job=createExportJob({projectId:"p1",timelineVersion:2,preset:"vertical-1080x1920",renderer:{id:"r1",verified:true},approval:{approved:true,by:"owner-1"}});
 assert.equal(job.state,"ready"); assert.equal(job.proofReceipt.projectId,"p1"); assert.equal(job.proofReceipt.timelineVersion,2);
});
