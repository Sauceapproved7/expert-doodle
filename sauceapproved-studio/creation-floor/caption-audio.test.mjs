import test from "node:test";
import assert from "node:assert/strict";
import {createTranscript,addCaptionCue,createAudioSession,addAudioLayer,buildMixPlan} from "./caption-audio.mjs";

test("Caption Lab creates project-scoped transcript with source provenance",()=>{
 const t=createTranscript({projectId:"p1",assetId:"a1",language:"en",source:"owner-media"});
 assert.equal(t.projectId,"p1"); assert.equal(t.cues.length,0); assert.equal(t.provenance.source,"owner-media");
});
test("caption cues require valid timing and preserve editable text",()=>{
 const t=createTranscript({projectId:"p1",assetId:"a1",language:"en",source:"owner-media"});
 const out=addCaptionCue(t,{id:"q1",startMs:1000,endMs:2500,text:"Sauce Approved"});
 assert.equal(out.cues[0].text,"Sauce Approved"); assert.equal(out.cues[0].durationMs,1500);
 assert.throws(()=>addCaptionCue(t,{id:"q2",startMs:3000,endMs:2000,text:"bad"}),/invalid_caption_timing/);
});
test("Audio Workbench layers remain non-destructive and rights-aware",()=>{
 let s=createAudioSession({projectId:"p1"});
 s=addAudioLayer(s,{id:"l1",assetId:"a1",kind:"music",rights:{status:"licensed"},gainDb:-4});
 assert.equal(s.layers[0].nonDestructive,true); assert.equal(s.layers[0].rights.status,"licensed");
});
test("mix plan blocks when any audio layer lacks cleared rights",()=>{
 let s=createAudioSession({projectId:"p1"});
 s=addAudioLayer(s,{id:"l1",assetId:"a1",kind:"music",rights:{status:"unknown"},gainDb:-4});
 const plan=buildMixPlan(s);
 assert.equal(plan.state,"blocked"); assert.deepEqual(plan.blockers,["audio_rights_clearance_required:l1"]);
});
