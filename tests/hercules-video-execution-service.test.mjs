import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {createCampaignExecutionPlan} from "../hercules-video/campaign-coordinator.mjs";
import {createAssemblyEvidence} from "../hercules-video/assembly-core.mjs";
import {executeCampaignPlan,verifyExecutionJournal} from "../hercules-video/execution-service.mjs";

const sha=label=>createHash("sha256").update(label).digest("hex");

const brief={
  title:"Execution Test",
  aspectRatio:"9:16",
  requireAudio:true,
  audioStrategy:"post",
  scenes:[
    {id:"a",durationSeconds:2,visual:"A",action:"A",text:"A",audio:"pulse"},
    {id:"b",durationSeconds:2,visual:"B",action:"B",text:"B",audio:"hit"},
  ],
};

const provider={
  id:"local-a",
  label:"Local A",
  kind:"self-hosted",
  capabilities:{aspectRatios:["9:16"],maxDurationSeconds:10,nativeAudio:false,references:true,editing:false},
  quality:{promptAdherence:.9,temporalConsistency:.9,visualQuality:.9,brandConsistency:.9,audioQuality:.1,artifactFreedom:.9,reliability:.9},
  cost:{estimatedCreditsPerSecond:0},
};

function makeAdapter() {
  const jobs=new Map();
  let seq=0;
  return {
    async health(){return {ok:true};},
    async generate(request){
      const id="job-"+(++seq);
      jobs.set(id,{request,status:"queued",polls:0});
      return {remoteJobId:id,status:"queued"};
    },
    async status(id){
      const job=jobs.get(id);
      if (!job) throw new Error("missing");
      job.polls++;
      job.status=job.polls>=2?"completed":"running";
      if (job.status==="completed") {
        job.artifact={
          uri:"file:///tmp/"+job.request.shot.id+"-"+id+".mp4",
          sha256:sha(job.request.shot.id+"-"+id),
          durationSeconds:job.request.shot.durationSeconds,
        };
      }
      return {status:job.status,artifact:job.artifact||null};
    },
    async inspect({remoteJobId}){
      const job=jobs.get(remoteJobId);
      return {status:job.status,artifact:job.artifact||null};
    },
  };
}

test("execution service drives render, tournament, assembly, and evidence end to end",async()=>{
  const plan=createCampaignExecutionPlan({projectId:"x",brief,providers:[provider],candidatesPerShot:1});
  const adapter=makeAdapter();
  const result=await executeCampaignPlan({
    executionPlan:plan,
    adapters:{"local-a":adapter},
    qualityEvaluator:async()=>({
      promptAdherence:.95,temporalConsistency:.94,visualQuality:.95,brandConsistency:.95,
      audioQuality:.1,artifactFreedom:.94,reliability:.9,
    }),
    audioTracks:[{
      id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",
      startSeconds:0,durationSeconds:4,gainDb:-8,sha256:sha("music"),
    }],
    assemblyExecutor:async assemblyPlan=>{
      const evidence=createAssemblyEvidence({
        plan:assemblyPlan,
        output:{uri:"file:///tmp/final.mp4",mimeType:"video/mp4",sizeBytes:100,sha256:sha("final")},
      });
      return {evidence};
    },
    pollIntervalMs:0,
    maxPolls:3,
    sleep:async()=>{},
    clock:(()=>{let i=0; return ()=>new Date(1700000000000+(i++*1000));})(),
  });

  assert.equal(result.status,"completed");
  assert.deepEqual(result.winners.winners.map(w=>w.shotId),["a","b"]);
  assert.equal(result.campaignEvidence.finalOutput.sha256,sha("final"));
  assert.equal(verifyExecutionJournal(result.journal),true);
  assert.ok(result.journal.entries.some(entry=>entry.event==="render_submitted"));
  assert.ok(result.journal.entries.some(entry=>entry.event==="assembly_completed"));
});

test("execution service fails closed when adapter is missing",async()=>{
  const plan=createCampaignExecutionPlan({projectId:"x",brief,providers:[provider],candidatesPerShot:1});
  await assert.rejects(()=>executeCampaignPlan({
    executionPlan:plan,
    adapters:{},
    qualityEvaluator:async()=>({}),
    audioTracks:[{id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",startSeconds:0,durationSeconds:4,sha256:sha("music")}],
    assemblyExecutor:async()=>({}),
  }),/execution_adapter_missing:local-a/);
});

test("execution service fails closed when render polling never reaches terminal state",async()=>{
  const plan=createCampaignExecutionPlan({projectId:"x",brief,providers:[provider],candidatesPerShot:1});
  const adapter={
    async health(){return {ok:true};},
    async generate(){return {remoteJobId:"stuck"};},
    async status(){return {status:"running"};},
    async inspect(){return {};},
  };
  await assert.rejects(()=>executeCampaignPlan({
    executionPlan:plan,
    adapters:{"local-a":adapter},
    qualityEvaluator:async()=>({}),
    audioTracks:[{id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",startSeconds:0,durationSeconds:4,sha256:sha("music")}],
    assemblyExecutor:async()=>({}),
    maxPolls:2,
    pollIntervalMs:0,
    sleep:async()=>{},
  }),/execution_render_poll_limit:stuck/);
});

test("execution service rejects assembly evidence that does not link to the assembly plan",async()=>{
  const plan=createCampaignExecutionPlan({projectId:"x",brief,providers:[provider],candidatesPerShot:1});
  const adapter=makeAdapter();
  await assert.rejects(()=>executeCampaignPlan({
    executionPlan:plan,
    adapters:{"local-a":adapter},
    qualityEvaluator:async()=>({
      promptAdherence:.95,temporalConsistency:.94,visualQuality:.95,brandConsistency:.95,
      audioQuality:.1,artifactFreedom:.94,reliability:.9,
    }),
    audioTracks:[{id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",startSeconds:0,durationSeconds:4,sha256:sha("music")}],
    assemblyExecutor:async()=>({evidence:{planFingerprint:"wrong",fingerprint:sha("e"),output:{sha256:sha("f")}}}),
    pollIntervalMs:0,
    maxPolls:3,
    sleep:async()=>{},
  }),/execution_assembly_evidence_invalid/);
});

test("execution journal verification detects tampering",async()=>{
  const plan=createCampaignExecutionPlan({projectId:"x",brief,providers:[provider],candidatesPerShot:1});
  const adapter=makeAdapter();
  const result=await executeCampaignPlan({
    executionPlan:plan,
    adapters:{"local-a":adapter},
    qualityEvaluator:async()=>({
      promptAdherence:.95,temporalConsistency:.94,visualQuality:.95,brandConsistency:.95,
      audioQuality:.1,artifactFreedom:.94,reliability:.9,
    }),
    audioTracks:[{id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",startSeconds:0,durationSeconds:4,sha256:sha("music")}],
    assemblyExecutor:async assemblyPlan=>({evidence:createAssemblyEvidence({
      plan:assemblyPlan,
      output:{uri:"file:///tmp/final.mp4",sizeBytes:1,sha256:sha("final")},
    })}),
    pollIntervalMs:0,
    maxPolls:3,
    sleep:async()=>{},
  });
  const tampered=structuredClone(result.journal);
  tampered.entries[1].event="changed";
  assert.throws(()=>verifyExecutionJournal(tampered),/execution_journal_entry_tampered/);
});
