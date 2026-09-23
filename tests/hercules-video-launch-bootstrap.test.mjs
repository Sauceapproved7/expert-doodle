import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import os from "node:os";
import {createHash} from "node:crypto";
import {mkdtemp,mkdir,readFile,writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {
  normalizeWan22LaunchConfig,
  prepareWan22LaunchHost,
  executeWan22Launch,
  createLaunchEvidenceBundle,
  writeLaunchEvidenceBundle,
} from "../hercules-video/launch-bootstrap.mjs";

const sha=value=>createHash("sha256").update(value).digest("hex");
const commit="0123456789abcdef0123456789abcdef01234567";
const quality={"promptAdherence":0.92,"temporalConsistency":0.91,"visualQuality":0.93,"brandConsistency":0.94,"audioQuality":0.8,"artifactFreedom":0.95,"reliability":0.96};

const brief={
  title:"Launch",
  aspectRatio:"9:16",
  requireAudio:true,
  audioStrategy:"post",
  scenes:[{id:"a",durationSeconds:2,visual:"A",action:"A",text:"BUILD",audio:"pulse"}],
};

async function fixture() {
  const root=await mkdtemp(path.join(os.tmpdir(),"hercules-bootstrap-"));
  const wanRepoDir=path.join(root,"wan");
  const checkpointDir=path.join(root,"checkpoint");
  const renderOutputDir=path.join(root,"renders");
  const finalDir=path.join(root,"final");
  await Promise.all([
    mkdir(wanRepoDir),
    mkdir(checkpointDir),
    mkdir(renderOutputDir),
    mkdir(finalDir),
  ]);
  const audioPath=path.join(root,"music.wav");
  await writeFile(audioPath,"approved-audio");
  const finalOutputPath=path.join(finalDir,"final.mp4");
  const evidenceOutputPath=path.join(finalDir,"evidence.json");
  return {
    root,
    audioPath,
    finalOutputPath,
    evidenceOutputPath,
    config:{
      projectId:"launch",
      runtimeId:"runtime-1",
      wanRepoDir,
      checkpointDir,
      renderOutputDir,
      finalOutputPath,
      evidenceOutputPath,
      upstreamCommit:commit,
      checkpointSha256:sha("checkpoint"),
      audioTracks:[{
        id:"music",
        kind:"soundtrack",
        uri:pathToFileURL(audioPath).href,
        startSeconds:0,
        durationSeconds:2,
        gainDb:-8,
        sha256:sha("approved-audio"),
      }],
    },
  };
}

test("launch config requires pinned local paths, model evidence, and local audio evidence",async()=>{
  const {config}=await fixture();
  const normalized=normalizeWan22LaunchConfig(config);
  assert.equal(normalized.upstreamCommit,commit);
  assert.equal(normalized.checkpointSha256,sha("checkpoint"));
  assert.equal(normalized.audioTracks[0].kind,"soundtrack");
  assert.throws(()=>normalizeWan22LaunchConfig({...config,wanRepoDir:"./Wan2.2"}),/launch_wan_repo_dir_required/);
  assert.throws(()=>normalizeWan22LaunchConfig({...config,checkpointSha256:"bad"}),/launch_checkpoint_sha256_required/);
  assert.throws(
    ()=>normalizeWan22LaunchConfig({...config,audioTracks:[{...config.audioTracks[0],uri:"https://example.com/music.wav"}]}),
    /launch_audio_local_uri_required:0/
  );
});

test("host preparation verifies audio checksum and refuses overwrite",async()=>{
  const {config,finalOutputPath}=await fixture();
  const fakeRunner={descriptor:{id:"wan22-ti2v-5b"},async health(){return {ok:true};}};
  const fakeAdapter={descriptor:{id:"local"},async health(){return {ok:true};}};

  await prepareWan22LaunchHost(config,{
    brief,
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>fakeRunner,
    runtimeFactory:()=>({}),
    adapterFactory:()=>fakeAdapter,
    serviceFactory:()=>({}),
  });

  const badAudio={...config,audioTracks:[{...config.audioTracks[0],sha256:"f".repeat(64)}]};
  await assert.rejects(()=>prepareWan22LaunchHost(badAudio,{
    brief,
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>fakeRunner,
    runtimeFactory:()=>({}),
    adapterFactory:()=>fakeAdapter,
    serviceFactory:()=>({}),
  }),/launch_audio_checksum_mismatch:0/);

  await writeFile(finalOutputPath,"existing");
  await assert.rejects(()=>prepareWan22LaunchHost(config,{
    brief,
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>fakeRunner,
    runtimeFactory:()=>({}),
    adapterFactory:()=>fakeAdapter,
    serviceFactory:()=>({}),
  }),/launch_final_output_exists/);
});

test("host preparation wires hardware, runner, runtime, adapter, service, and plan",async()=>{
  const {config}=await fixture();
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

  const host=await prepareWan22LaunchHost(config,{
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
  });

  assert.equal(host.executionPlan.renderRequests.length,1);
  assert.equal(host.executionPlan.renderRequests[0].shot.audioStrategy,"post");
  assert.equal(host.executionPlan.policy.commercialFallback,false);
  assert.ok(calls.includes("runner-health"));
  assert.ok(calls.includes("adapter-health"));
});

test("launch execution binds evaluation to exact render and verifies final output checksum",async()=>{
  const {config,finalOutputPath}=await fixture();
  const writes=[];
  const artifactSha=sha("render-a");
  const finalBytes="final-video";
  const finalSha=sha(finalBytes);

  const fakeService={
    async start(plan){return {phase:"rendering",fingerprint:sha("s1"),executionPlanFingerprint:plan.fingerprint};},
    async awaitRenders(plan,session){return {...session,phase:"renders_completed",fingerprint:sha("s2")};},
    async finalize({executionPlan,session,evaluate,audioTracks,assemblyRunner,outputPath}){
      assert.equal(session.phase,"renders_completed");
      assert.equal(audioTracks.length,1);
      const shot=executionPlan.storyboard.shots[0];
      const request=executionPlan.renderRequests[0];
      const route=executionPlan.routes[0];
      const artifact={
        uri:pathToFileURL(path.join(path.dirname(outputPath),"a.mp4")).href,
        sha256:artifactSha,
        sizeBytes:123,
        durationSeconds:2,
      };
      const scored=await evaluate({shot,request,artifact,route});
      assert.deepEqual(scored,quality);
      const assemblyPlan={fingerprint:sha("assembly-plan")};
      const assemblyResult=await assemblyRunner(assemblyPlan,{outputPath});
      return {
        session:{phase:"completed",fingerprint:sha("session-final")},
        winners:{fingerprint:sha("winners")},
        assemblyPlan,
        assemblyResult,
        campaignEvidence:{
          fingerprint:sha("campaign"),
          finalOutput:{uri:pathToFileURL(outputPath).href,sha256:finalSha,sizeBytes:finalBytes.length},
        },
      };
    },
  };

  const result=await executeWan22Launch(config,{
    brief,
    qualityEvaluator:async ({artifact})=>({
      artifactSha256:artifact.sha256,
      method:"fixture-measurement-v1",
      evaluatorId:"fixture-evaluator",
      quality,
    }),
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>({descriptor:{id:"wan"},async health(){return {ok:true};}}),
    runtimeFactory:()=>({}),
    adapterFactory:()=>({descriptor:{id:"local"},async health(){return {ok:true};}}),
    serviceFactory:()=>fakeService,
    assemblyRunner:async(plan,{outputPath})=>{
      await writeFile(outputPath,finalBytes);
      return {evidence:{
        fingerprint:sha("assembly-evidence"),
        planFingerprint:plan.fingerprint,
        output:{uri:pathToFileURL(outputPath).href,sha256:finalSha,sizeBytes:finalBytes.length},
      }};
    },
    writeFileImpl:async(filePath,bytes,options)=>{
      writes.push({filePath,bytes,options});
      await writeFile(filePath,bytes,options);
    },
  });

  assert.equal(result.status,"completed");
  assert.equal(result.evidenceBundle.campaignEvidenceFingerprint,sha("campaign"));
  assert.equal(result.evidenceBundle.finalOutputSha256,finalSha);
  assert.equal(result.evidenceBundle.evaluations.length,1);
  assert.equal(result.evidenceBundle.evaluations[0].artifactSha256,artifactSha);
  assert.equal(result.evidenceBundle.evaluations[0].method,"fixture-measurement-v1");
  assert.equal(result.evidenceExport.bundleFingerprint,result.evidenceBundle.fingerprint);
  assert.equal(writes.length,1);
  assert.equal(writes[0].options.flag,"wx");

  const saved=JSON.parse(await readFile(config.evidenceOutputPath,"utf8"));
  assert.equal(saved.fingerprint,result.evidenceBundle.fingerprint);
  assert.equal(await readFile(finalOutputPath,"utf8"),finalBytes);
});

test("launch execution rejects evaluation evidence bound to another artifact",async()=>{
  const {config}=await fixture();
  const fakeService={
    async start(){return {phase:"rendering",fingerprint:sha("s1")};},
    async awaitRenders(_plan,session){return {...session,phase:"renders_completed",fingerprint:sha("s2")};},
    async finalize({executionPlan,evaluate}){
      const shot=executionPlan.storyboard.shots[0];
      await evaluate({
        shot,
        request:executionPlan.renderRequests[0],
        route:executionPlan.routes[0],
        artifact:{uri:"file:///tmp/a.mp4",sha256:sha("real-render"),sizeBytes:10,durationSeconds:2},
      });
      throw new Error("should_not_continue");
    },
  };
  await assert.rejects(()=>executeWan22Launch(config,{
    brief,
    qualityEvaluator:async()=>({
      artifactSha256:sha("different-render"),
      method:"fixture",
      evaluatorId:"fixture",
      quality,
    }),
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>({descriptor:{id:"wan"},async health(){return {ok:true};}}),
    runtimeFactory:()=>({}),
    adapterFactory:()=>({descriptor:{id:"local"},async health(){return {ok:true};}}),
    serviceFactory:()=>fakeService,
  }),/launch_evaluation_artifact_mismatch:a/);
});

test("launch execution rejects incomplete quality evidence",async()=>{
  const {config}=await fixture();
  const fakeService={
    async start(){return {phase:"rendering",fingerprint:sha("s1")};},
    async awaitRenders(_plan,session){return {...session,phase:"renders_completed",fingerprint:sha("s2")};},
    async finalize({executionPlan,evaluate}){
      const shot=executionPlan.storyboard.shots[0];
      await evaluate({
        shot,
        request:executionPlan.renderRequests[0],
        route:executionPlan.routes[0],
        artifact:{uri:"file:///tmp/a.mp4",sha256:sha("render"),sizeBytes:10,durationSeconds:2},
      });
      throw new Error("should_not_continue");
    },
  };
  await assert.rejects(()=>executeWan22Launch(config,{
    brief,
    qualityEvaluator:async ({artifact})=>({
      artifactSha256:artifact.sha256,
      method:"fixture",
      evaluatorId:"fixture",
      quality:{promptAdherence:1},
    }),
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>({descriptor:{id:"wan"},async health(){return {ok:true};}}),
    runtimeFactory:()=>({}),
    adapterFactory:()=>({descriptor:{id:"local"},async health(){return {ok:true};}}),
    serviceFactory:()=>fakeService,
  }),/launch_evaluation_quality_invalid:a:temporalConsistency/);
});

test("launch execution rejects final file that does not match campaign evidence",async()=>{
  const {config}=await fixture();
  const actual="actual-final";
  const fakeService={
    async start(){return {phase:"rendering",fingerprint:sha("s1")};},
    async awaitRenders(_plan,session){return {...session,phase:"renders_completed",fingerprint:sha("s2")};},
    async finalize({executionPlan,evaluate,outputPath}){
      const shot=executionPlan.storyboard.shots[0];
      const artifact={uri:"file:///tmp/a.mp4",sha256:sha("render"),sizeBytes:10,durationSeconds:2};
      await evaluate({shot,request:executionPlan.renderRequests[0],route:executionPlan.routes[0],artifact});
      await writeFile(outputPath,actual);
      return {
        session:{fingerprint:sha("session")},
        winners:{fingerprint:sha("winners")},
        assemblyPlan:{fingerprint:sha("assembly-plan")},
        assemblyResult:{evidence:{fingerprint:sha("assembly-evidence")}},
        campaignEvidence:{
          fingerprint:sha("campaign"),
          finalOutput:{uri:pathToFileURL(outputPath).href,sha256:sha("other-final"),sizeBytes:12},
        },
      };
    },
  };
  await assert.rejects(()=>executeWan22Launch(config,{
    brief,
    qualityEvaluator:async ({artifact})=>({
      artifactSha256:artifact.sha256,
      method:"fixture",
      evaluatorId:"fixture",
      quality,
    }),
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>({descriptor:{id:"wan"},async health(){return {ok:true};}}),
    runtimeFactory:()=>({}),
    adapterFactory:()=>({descriptor:{id:"local"},async health(){return {ok:true};}}),
    serviceFactory:()=>fakeService,
  }),/launch_final_output_checksum_mismatch/);
});

test("evidence bundle pins model, evaluations, and final campaign evidence",()=> {
  const executionPlan={projectId:"x",fingerprint:sha("plan")};
  const finalization={
    session:{fingerprint:sha("session")},
    winners:{fingerprint:sha("winners")},
    assemblyPlan:{fingerprint:sha("assembly-plan")},
    assemblyResult:{evidence:{fingerprint:sha("assembly-evidence")}},
    campaignEvidence:{fingerprint:sha("campaign"),finalOutput:{sha256:sha("final")}},
  };
  const evaluations=[{
    shotId:"a",
    artifactSha256:sha("render"),
    method:"fixture",
    evaluatorId:"fixture",
    quality,
    fingerprint:sha("evaluation"),
  }];
  const bundle=createLaunchEvidenceBundle({
    executionPlan,
    finalization,
    hardwareProbe:{eligible:true},
    config:{upstreamCommit:commit,checkpointSha256:sha("checkpoint")},
    evaluations,
    finalOutputSha256:sha("final"),
  });
  assert.equal(bundle.runtime.upstreamCommit,commit);
  assert.equal(bundle.runtime.checkpointSha256,sha("checkpoint"));
  assert.equal(bundle.finalOutput.sha256,sha("final"));
  assert.equal(bundle.finalOutputSha256,sha("final"));
  assert.equal(bundle.evaluations[0].shotId,"a");
});

test("evidence export uses exclusive-create mode and hashes exact serialized bundle",async()=>{
  const {root}=await fixture();
  const bundle={schema:"x",fingerprint:sha("bundle")};
  const output=path.join(root,"bundle.json");
  const result=await writeLaunchEvidenceBundle(bundle,output);
  const captured=await readFile(output);
  assert.equal(result.sizeBytes,captured.length);
  assert.equal(result.sha256,createHash("sha256").update(captured).digest("hex"));
  await assert.rejects(()=>writeLaunchEvidenceBundle(bundle,output),error=>{
    assert.equal(error.code,"EEXIST");
    return true;
  });
});

test("launch execution refuses to invent quality evaluation",async()=>{
  const {config}=await fixture();
  await assert.rejects(()=>executeWan22Launch(config,{brief}),/launch_quality_evaluator_required/);
});
