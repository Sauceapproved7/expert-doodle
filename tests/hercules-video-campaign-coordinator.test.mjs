import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {
  createCampaignExecutionPlan,
  collectCampaignWinners,
  createCampaignAssemblyPlan,
  createCampaignEvidencePackage,
} from "../hercules-video/campaign-coordinator.mjs";
import {createAssemblyEvidence} from "../hercules-video/assembly-core.mjs";

const sha=label=>createHash("sha256").update(label).digest("hex");

const brief={
  title:"Hercules Launch",
  campaign:"DON'T TRUST THE AI. TRUST THE EVIDENCE.",
  aspectRatio:"9:16",
  requireAudio:true,
  audioStrategy:"post",
  scenes:[
    {id:"a",durationSeconds:4,visual:"Build graph",action:"assemble",text:"BUILD",audio:"pulse"},
    {id:"b",durationSeconds:5,visual:"Recovery",action:"restore",text:"RECOVER",audio:"impact"},
  ],
};

const localProvider={
  id:"wan-local",
  label:"Wan Local",
  kind:"self-hosted",
  capabilities:{aspectRatios:["9:16"],maxDurationSeconds:10,nativeAudio:false,references:true,editing:false},
  quality:{promptAdherence:.9,temporalConsistency:.9,visualQuality:.9,brandConsistency:.9,audioQuality:.2,artifactFreedom:.9,reliability:.9},
  cost:{estimatedCreditsPerSecond:0},
};

const commercialProvider={
  id:"cloud",
  label:"Cloud",
  kind:"commercial",
  capabilities:{aspectRatios:["9:16"],maxDurationSeconds:10,nativeAudio:true,references:true,editing:true},
  quality:{promptAdherence:1,temporalConsistency:1,visualQuality:1,brandConsistency:1,audioQuality:1,artifactFreedom:1,reliability:1},
  cost:{estimatedCreditsPerSecond:0},
};

test("campaign plan is deterministic, self-hosted only, and preserves post-audio",()=>{
  const a=createCampaignExecutionPlan({projectId:"launch",brief,providers:[commercialProvider,localProvider]});
  const b=createCampaignExecutionPlan({projectId:"launch",brief,providers:[commercialProvider,localProvider]});
  assert.equal(a.fingerprint,b.fingerprint);
  assert.equal(a.routes.every(route=>route.selected.providerId==="wan-local"),true);
  assert.equal(a.renderRequests.every(request=>request.shot.audioStrategy==="post"),true);
  assert.equal(a.policy.commercialFallback,false);
});

test("campaign plan blocks when no self-hosted route exists",()=>{
  assert.throws(()=>createCampaignExecutionPlan({
    projectId:"launch",brief,providers:[commercialProvider],
  }),/campaign_self_hosted_provider_required/);
});

test("campaign winner collection preserves storyboard order and actual tournament winners",()=>{
  const plan=createCampaignExecutionPlan({projectId:"launch",brief,providers:[localProvider]});
  const rounds=[
    {shotId:"b",renders:[{
      id:"b1",providerId:"wan-local",
      quality:{promptAdherence:.95,temporalConsistency:.94,visualQuality:.95,brandConsistency:.95,audioQuality:.1,artifactFreedom:.94,reliability:.9},
      artifact:{uri:"file:///tmp/b.mp4",sha256:sha("b"),durationSeconds:5},
    }]},
    {shotId:"a",renders:[{
      id:"a1",providerId:"wan-local",
      quality:{promptAdherence:.95,temporalConsistency:.94,visualQuality:.95,brandConsistency:.95,audioQuality:.1,artifactFreedom:.94,reliability:.9},
      artifact:{uri:"file:///tmp/a.mp4",sha256:sha("a"),durationSeconds:4},
    }]},
  ];
  const winners=collectCampaignWinners(plan,rounds,.7);
  assert.deepEqual(winners.winners.map(w=>w.shotId),["a","b"]);
  assert.deepEqual(winners.winners.map(w=>w.renderId),["a1","b1"]);
});

test("campaign assembly blocks when required winner is missing",()=>{
  const plan=createCampaignExecutionPlan({projectId:"launch",brief,providers:[localProvider]});
  const winners={
    executionPlanFingerprint:plan.fingerprint,
    fingerprint:sha("winners"),
    winners:[{
      shotId:"a",renderId:"a1",providerId:"wan-local",score:.9,
      artifact:{uri:"file:///tmp/a.mp4",sha256:sha("a"),durationSeconds:4},
    }],
  };
  assert.throws(()=>createCampaignAssemblyPlan({executionPlan:plan,winners,audioTracks:[]}),/campaign_missing_winner:b/);
});

test("campaign assembly blocks when post-audio evidence is missing",()=>{
  const plan=createCampaignExecutionPlan({projectId:"launch",brief,providers:[localProvider]});
  const winners={
    executionPlanFingerprint:plan.fingerprint,
    fingerprint:sha("winners-complete"),
    winners:[
      {shotId:"a",renderId:"a1",providerId:"wan-local",score:.9,artifact:{uri:"file:///tmp/a.mp4",sha256:sha("a"),durationSeconds:4}},
      {shotId:"b",renderId:"b1",providerId:"wan-local",score:.9,artifact:{uri:"file:///tmp/b.mp4",sha256:sha("b"),durationSeconds:5}},
    ],
  };
  assert.throws(()=>createCampaignAssemblyPlan({executionPlan:plan,winners,audioTracks:[]}),/campaign_post_audio_evidence_required/);
});

test("campaign assembly uses winner order, captions, and verified post-audio inputs",()=>{
  const plan=createCampaignExecutionPlan({projectId:"launch",brief,providers:[localProvider]});
  const winners={
    executionPlanFingerprint:plan.fingerprint,
    fingerprint:sha("winners-ordered"),
    winners:[
      {shotId:"b",renderId:"b1",providerId:"wan-local",score:.9,artifact:{uri:"file:///tmp/b.mp4",sha256:sha("b"),durationSeconds:5}},
      {shotId:"a",renderId:"a1",providerId:"wan-local",score:.9,artifact:{uri:"file:///tmp/a.mp4",sha256:sha("a"),durationSeconds:4}},
    ],
  };
  const assembly=createCampaignAssemblyPlan({
    executionPlan:plan,
    winners,
    audioTracks:[{
      id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",
      startSeconds:0,durationSeconds:9,gainDb:-8,sha256:sha("music"),
    }],
  });
  assert.deepEqual(assembly.clips.map(clip=>clip.shotId),["a","b"]);
  assert.deepEqual(assembly.captions.map(c=>c.text),["BUILD","RECOVER"]);
  assert.equal(assembly.totalDurationSeconds,9);
});

test("campaign evidence package links every deterministic stage to final output",()=>{
  const plan=createCampaignExecutionPlan({projectId:"launch",brief,providers:[localProvider]});
  const winners={
    executionPlanFingerprint:plan.fingerprint,
    fingerprint:sha("winners-linked"),
    winners:[
      {shotId:"a",renderId:"a1",providerId:"wan-local",score:.9,artifact:{uri:"file:///tmp/a.mp4",sha256:sha("a"),durationSeconds:4}},
      {shotId:"b",renderId:"b1",providerId:"wan-local",score:.9,artifact:{uri:"file:///tmp/b.mp4",sha256:sha("b"),durationSeconds:5}},
    ],
  };
  const assembly=createCampaignAssemblyPlan({
    executionPlan:plan,
    winners,
    audioTracks:[{
      id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",
      startSeconds:0,durationSeconds:9,gainDb:-8,sha256:sha("music"),
    }],
  });
  const assemblyEvidence=createAssemblyEvidence({
    plan:assembly,
    output:{uri:"file:///tmp/final.mp4",mimeType:"video/mp4",sizeBytes:123,sha256:sha("final")},
  });
  const evidence=createCampaignEvidencePackage({
    executionPlan:plan,winners,assemblyPlan:assembly,assemblyEvidence,
  });
  assert.equal(evidence.executionPlanFingerprint,plan.fingerprint);
  assert.equal(evidence.assemblyPlanFingerprint,assembly.fingerprint);
  assert.equal(evidence.finalOutput.sha256,sha("final"));
  assert.match(evidence.fingerprint,/^[a-f0-9]{64}$/);
});
