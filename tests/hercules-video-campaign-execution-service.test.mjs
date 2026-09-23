import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {createCampaignExecutionPlan} from "../hercules-video/campaign-coordinator.mjs";
import {
  HerculesCampaignExecutionService,
  validateCampaignExecutionSession,
} from "../hercules-video/campaign-execution-service.mjs";
import {createAssemblyEvidence} from "../hercules-video/assembly-core.mjs";

const sha=label=>createHash("sha256").update(label).digest("hex");

const brief={
  title:"Hercules Launch",
  aspectRatio:"9:16",
  requireAudio:true,
  audioStrategy:"post",
  scenes:[
    {id:"a",durationSeconds:4,visual:"Build graph",action:"assemble",text:"BUILD",audio:"pulse"},
    {id:"b",durationSeconds:5,visual:"Recovery",action:"restore",text:"RECOVER",audio:"impact"},
  ],
};

const provider={
  id:"wan-local",
  label:"Wan Local",
  kind:"self-hosted",
  capabilities:{aspectRatios:["9:16"],maxDurationSeconds:10,nativeAudio:false,references:true,editing:false},
  quality:{promptAdherence:.9,temporalConsistency:.9,visualQuality:.9,brandConsistency:.9,audioQuality:.2,artifactFreedom:.9,reliability:.9},
  cost:{estimatedCreditsPerSecond:0},
};

function plan(){
  return createCampaignExecutionPlan({projectId:"launch",brief,providers:[provider]});
}

function clock(){
  let tick=0;
  return ()=>new Date(Date.UTC(2026,8,23,18,0,tick++));
}

function artifact(shotId,durationSeconds){
  return {
    uri:`file:///tmp/${shotId}.mp4`,
    mimeType:"video/mp4",
    sizeBytes:100 + durationSeconds,
    sha256:sha(shotId),
    durationSeconds,
  };
}

class FakeAdapter {
  constructor({healthy=true,missingArtifact=false,failShot=null}={}){
    this.descriptor={id:"fake-self-hosted",kind:"self-hosted",runtimeId:"local-test"};
    this.healthy=healthy;
    this.missingArtifact=missingArtifact;
    this.failShot=failShot;
    this.requests=new Map();
  }
  async health(){
    return {
      ok:this.healthy,
      runtimeId:"local-test",
      runner:{id:"fake-runner"},
      runnerHealth:{ok:this.healthy,runnerId:"fake-runner"},
    };
  }
  async estimate(){ return {supported:true,estimatedSeconds:1}; }
  async generate(request){
    const id="job-" + request.shot.id;
    this.requests.set(id,request);
    return {remoteJobId:id,reused:false,status:"queued"};
  }
  async inspect(asset){ return this.status(asset.remoteJobId || asset.jobId); }
  async status(remoteJobId){
    const request=this.requests.get(remoteJobId);
    if (!request) throw new Error("fake_job_missing");
    if (request.shot.id===this.failShot) {
      return {jobId:remoteJobId,status:"failed",artifact:null,error:{code:"fake_failed",message:"failed",retryable:false}};
    }
    return {
      jobId:remoteJobId,
      status:"completed",
      artifact:this.missingArtifact ? null : artifact(request.shot.id,request.shot.durationSeconds),
      error:null,
    };
  }
}

test("execution service submits local jobs and records verified completion",async()=>{
  const executionPlan=plan();
  const service=new HerculesCampaignExecutionService({
    adapter:new FakeAdapter(),
    clock:clock(),
    sleep:async()=>{},
  });
  const started=await service.start(executionPlan);
  assert.equal(started.phase,"rendering");
  assert.deepEqual(started.jobs.map(job=>job.status),["queued","queued"]);

  const completed=await service.awaitRenders(executionPlan,started,{maxPolls:2,pollIntervalMs:0});
  assert.equal(completed.phase,"renders_completed");
  assert.deepEqual(completed.jobs.map(job=>job.status),["completed","completed"]);
  assert.deepEqual(completed.jobs.map(job=>job.artifact.sha256),[sha("a"),sha("b")]);
  assert.equal(completed.events.some(event=>event.type==="render_submitted"),true);
  assert.equal(completed.events.some(event=>event.type==="render_status" && event.to==="completed"),true);
  assert.equal(validateCampaignExecutionSession(completed),completed);
});

test("execution session fingerprint rejects tampering",async()=>{
  const executionPlan=plan();
  const service=new HerculesCampaignExecutionService({adapter:new FakeAdapter(),clock:clock(),sleep:async()=>{}});
  const started=await service.start(executionPlan);
  const tampered={...started,phase:"completed"};
  assert.throws(()=>validateCampaignExecutionSession(tampered),/campaign_execution_session_fingerprint_mismatch/);
});

test("execution service fails closed on unhealthy runtime",async()=>{
  const service=new HerculesCampaignExecutionService({adapter:new FakeAdapter({healthy:false}),clock:clock()});
  await assert.rejects(()=>service.start(plan()),error=>{
    assert.match(error.message,/campaign_execution_runtime_unhealthy/);
    return true;
  });
});

test("execution service rejects completed jobs without artifact evidence",async()=>{
  const executionPlan=plan();
  const service=new HerculesCampaignExecutionService({
    adapter:new FakeAdapter({missingArtifact:true}),
    clock:clock(),
    sleep:async()=>{},
  });
  const started=await service.start(executionPlan);
  await assert.rejects(()=>service.refresh(executionPlan,started),/campaign_execution_artifact_required:a/);
});

test("execution service fails closed when a render fails",async()=>{
  const executionPlan=plan();
  const service=new HerculesCampaignExecutionService({
    adapter:new FakeAdapter({failShot:"b"}),
    clock:clock(),
    sleep:async()=>{},
  });
  const started=await service.start(executionPlan);
  await assert.rejects(()=>service.awaitRenders(executionPlan,started,{maxPolls:2,pollIntervalMs:0}),error=>{
    assert.equal(error.session.phase,"failed");
    assert.deepEqual(error.session.error.failedShots,["b"]);
    return true;
  });
});

test("finalization links evaluated renders, post-audio assembly, and final evidence",async()=>{
  const executionPlan=plan();
  const service=new HerculesCampaignExecutionService({
    adapter:new FakeAdapter(),
    clock:clock(),
    sleep:async()=>{},
  });
  const started=await service.start(executionPlan);
  const rendered=await service.awaitRenders(executionPlan,started,{maxPolls:2,pollIntervalMs:0});

  const quality={
    promptAdherence:.95,
    temporalConsistency:.95,
    visualQuality:.95,
    brandConsistency:.95,
    audioQuality:.5,
    artifactFreedom:.95,
    reliability:.95,
  };
  const audioTracks=[{
    id:"music",
    kind:"soundtrack",
    uri:"file:///tmp/music.wav",
    startSeconds:0,
    durationSeconds:9,
    gainDb:-8,
    sha256:sha("music"),
  }];

  const result=await service.finalize({
    executionPlan,
    session:rendered,
    evaluate:async()=>quality,
    audioTracks,
    outputPath:"/tmp/final.mp4",
    minimumScore:.7,
    assemblyRunner:async assemblyPlan=>({
      output:{uri:"file:///tmp/final.mp4",mimeType:"video/mp4",sizeBytes:999,sha256:sha("final")},
      evidence:createAssemblyEvidence({
        plan:assemblyPlan,
        output:{uri:"file:///tmp/final.mp4",mimeType:"video/mp4",sizeBytes:999,sha256:sha("final")},
      }),
    }),
  });

  assert.equal(result.session.phase,"completed");
  assert.equal(result.rounds.length,2);
  assert.deepEqual(result.winners.winners.map(winner=>winner.shotId),["a","b"]);
  assert.deepEqual(result.assemblyPlan.clips.map(clip=>clip.shotId),["a","b"]);
  assert.equal(result.assemblyPlan.audioTracks[0].kind,"soundtrack");
  assert.equal(result.campaignEvidence.finalOutput.sha256,sha("final"));
  assert.equal(result.session.campaignEvidenceFingerprint,result.campaignEvidence.fingerprint);
  assert.equal(result.session.finalOutput.sha256,sha("final"));
});
