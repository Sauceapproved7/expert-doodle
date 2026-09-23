import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {createHash} from "node:crypto";
import {
  normalizeWan22LaunchConfig,
  prepareWan22LaunchHost,
  executeWan22Launch,
  createLaunchEvidenceBundle,
  writeLaunchEvidenceBundle,
  resolveLaunchQualityEvaluator,
} from "../hercules-video/launch-bootstrap.mjs";

const sha=label=>createHash("sha256").update(label).digest("hex");
const commit="0123456789abcdef0123456789abcdef01234567";

const brief={
  title:"Launch",
  aspectRatio:"9:16",
  requireAudio:true,
  audioStrategy:"post",
  scenes:[{id:"a",durationSeconds:2,visual:"A",action:"A",text:"BUILD",audio:"pulse"}],
};

function config(){
  return {
    projectId:"launch",
    runtimeId:"runtime-1",
    wanRepoDir:"/opt/wan",
    checkpointDir:"/models/wan",
    renderOutputDir:"/tmp/hercules-renders",
    finalOutputPath:"/tmp/hercules/final.mp4",
    evidenceOutputPath:"/tmp/hercules/evidence.json",
    upstreamCommit:commit,
    checkpointSha256:sha("checkpoint"),
    audioTracks:[{
      id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",
      startSeconds:0,durationSeconds:2,gainDb:-8,sha256:sha("music"),
    }],
  };
}

test("launch config requires pinned local paths and model evidence",()=>{
  const normalized=normalizeWan22LaunchConfig(config());
  assert.equal(normalized.upstreamCommit,commit);
  assert.equal(normalized.checkpointSha256,sha("checkpoint"));
  assert.throws(()=>normalizeWan22LaunchConfig({...config(),wanRepoDir:"./Wan2.2"}),/launch_wan_repo_dir_required/);
  assert.throws(()=>normalizeWan22LaunchConfig({...config(),checkpointSha256:"bad"}),/launch_checkpoint_sha256_required/);
});

test("host preparation wires hardware, runner, runtime, adapter, service, and plan",async()=>{
  const calls=[];
  const fakeRunner={
    descriptor:{id:"wan22-ti2v-5b"},
    async health(){calls.push("runner-health");return {ok:true};},
  };
  const fakeRuntime={};
  const fakeAdapter={
    descriptor:{id:"wan22-ti2v-5b-local"},
    async health(){calls.push("adapter-health");return {ok:true};},
  };
  const fakeService={};

  const host=await prepareWan22LaunchHost(config(),{
    brief,
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:options=>{calls.push(["runner",options.upstreamCommit,options.checkpointSha256]);return fakeRunner;},
    runtimeFactory:options=>{calls.push(["runtime",options.runtimeId]);return fakeRuntime;},
    adapterFactory:options=>{calls.push(["adapter",options.id]);return fakeAdapter;},
    serviceFactory:options=>{calls.push(["service",options.adapter===fakeAdapter]);return fakeService;},
    mkdirImpl:async()=>{},
  });

  assert.equal(host.executionPlan.renderRequests.length,1);
  assert.equal(host.executionPlan.renderRequests[0].shot.audioStrategy,"post");
  assert.equal(host.executionPlan.policy.commercialFallback,false);
  assert.ok(calls.includes("runner-health"));
  assert.ok(calls.includes("adapter-health"));
});

test("launch execution drives canonical service and exports evidence",async()=>{
  const writes=[];
  const fakeService={
    async start(plan){return {phase:"rendering",fingerprint:sha("s1"),executionPlanFingerprint:plan.fingerprint};},
    async awaitRenders(plan,session){return {...session,phase:"renders_completed",fingerprint:sha("s2")};},
    async finalize({executionPlan,session,evaluate,audioTracks,assemblyRunner,outputPath}){
      assert.equal(session.phase,"renders_completed");
      assert.equal(typeof evaluate,"function");
      assert.equal(audioTracks.length,1);
      const assemblyPlan={fingerprint:sha("assembly-plan")};
      const assemblyResult=await assemblyRunner(assemblyPlan,{outputPath});
      return {
        session:{phase:"completed",fingerprint:sha("session-final")},
        winners:{fingerprint:sha("winners")},
        assemblyPlan,
        assemblyResult,
        campaignEvidence:{
          fingerprint:sha("campaign"),
          finalOutput:{uri:"file:///tmp/hercules/final.mp4",sha256:sha("final"),sizeBytes:10},
        },
      };
    },
  };

  const result=await executeWan22Launch(config(),{
    brief,
    semanticEvaluator:async()=>({
      promptAdherence:1,temporalConsistency:1,visualQuality:1,brandConsistency:1,
      artifactFreedom:1,reliability:1,
    }),
    technicalProbe:async()=>({width:704,height:1280,fps:24,durationSeconds:2}),
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>({descriptor:{id:"wan"},async health(){return {ok:true};}}),
    runtimeFactory:()=>({}),
    adapterFactory:()=>({descriptor:{id:"local"},async health(){return {ok:true};}}),
    serviceFactory:()=>fakeService,
    mkdirImpl:async()=>{},
    assemblyRunner:async(plan,{outputPath})=>{
      assert.equal(outputPath,"/tmp/hercules/final.mp4");
      return {evidence:{fingerprint:sha("assembly-evidence"),planFingerprint:plan.fingerprint,output:{uri:"file:///tmp/hercules/final.mp4",sha256:sha("final"),sizeBytes:10}}};
    },
    writeFileImpl:async(filePath,bytes)=>writes.push({filePath,bytes}),
  });

  assert.equal(result.status,"completed");
  assert.equal(result.evidenceBundle.campaignEvidenceFingerprint,sha("campaign"));
  assert.equal(result.evidenceExport.bundleFingerprint,result.evidenceBundle.fingerprint);
  assert.equal(writes.length,1);
  assert.equal(writes[0].filePath,"/tmp/hercules/evidence.json");
});

test("evidence bundle pins model and final campaign evidence",()=>{
  const executionPlan={projectId:"x",fingerprint:sha("plan")};
  const finalization={
    session:{fingerprint:sha("session")},
    winners:{fingerprint:sha("winners")},
    assemblyPlan:{fingerprint:sha("assembly-plan")},
    assemblyResult:{evidence:{fingerprint:sha("assembly-evidence")}},
    campaignEvidence:{fingerprint:sha("campaign"),finalOutput:{sha256:sha("final")}},
  };
  const bundle=createLaunchEvidenceBundle({
    executionPlan,
    finalization,
    hardwareProbe:{eligible:true},
    config:{upstreamCommit:commit,checkpointSha256:sha("checkpoint")},
  });
  assert.equal(bundle.runtime.upstreamCommit,commit);
  assert.equal(bundle.runtime.checkpointSha256,sha("checkpoint"));
  assert.equal(bundle.finalOutput.sha256,sha("final"));
});

test("evidence export hashes exact serialized bundle",async()=>{
  const bundle={schema:"x",fingerprint:sha("bundle")};
  let captured=null;
  const result=await writeLaunchEvidenceBundle(bundle,"/tmp/evidence.json",{
    writeFileImpl:async(_path,bytes)=>{captured=bytes;},
  });
  assert.ok(Buffer.isBuffer(captured));
  assert.equal(result.sizeBytes,captured.length);
  assert.equal(result.sha256,createHash("sha256").update(captured).digest("hex"));
});

test("launch execution refuses to invent quality evaluation",async()=>{
  await assert.rejects(()=>executeWan22Launch(config(),{brief}),/launch_semantic_evaluator_required/);
});

test("launch rejects a raw un-gated quality evaluator",async()=>{
  await assert.rejects(()=>executeWan22Launch(config(),{
    brief,
    qualityEvaluator:async()=>({promptAdherence:1}),
  }),/launch_unverified_quality_evaluator_rejected/);
});

test("launch accepts only a Hercules-marked quality gate when passed directly",()=>{
  const marked=Object.assign(async()=>({promptAdherence:1}),{herculesRenderAcceptanceGate:true});
  assert.equal(resolveLaunchQualityEvaluator({qualityEvaluator:marked}),marked);
  assert.throws(()=>resolveLaunchQualityEvaluator({
    qualityEvaluator:async()=>({promptAdherence:1}),
  }),/launch_unverified_quality_evaluator_rejected/);
});
