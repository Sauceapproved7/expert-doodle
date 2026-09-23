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

const brief={
  title:"Launch",
  aspectRatio:"9:16",
  requireAudio:true,
  audioStrategy:"post",
  scenes:[{id:"a",durationSeconds:2,visual:"A",action:"A",text:"BUILD",audio:"pulse"}],
};

const qualityResult={
  promptAdherence:.9,
  temporalConsistency:.9,
  visualQuality:.9,
  brandConsistency:.9,
  audioQuality:1,
  artifactFreedom:.9,
  reliability:.9,
  technicalPassed:true,
  technicalEvidence:{
    passed:true,
    checks:{aspectRatio:true,duration:true,fps:true},
    measured:{width:704,height:1280,fps:24,durationSeconds:2,aspectRatio:.55},
    deltas:{ratioError:0,durationError:0,fpsError:0},
  },
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

function hostDependencies() {
  return {
    brief,
    probeHost:async()=>({
      cudaAvailable:true,
      cudaToolkitVersion:"12.4",
      gpus:[{name:"RTX 4090",memoryGiB:24,memoryMiB:24564}],
    }),
    runnerFactory:()=>({descriptor:{id:"wan"},async health(){return {ok:true};}}),
    runtimeFactory:()=>({}),
    adapterFactory:()=>({descriptor:{id:"local"},async health(){return {ok:true};}}),
  };
}

test("launch config requires pinned paths, model evidence, and local audio URI",async()=>{
  const {config}=await fixture();
  const normalized=normalizeWan22LaunchConfig(config);
  assert.equal(normalized.upstreamCommit,commit);
  assert.equal(normalized.checkpointSha256,sha("checkpoint"));
  assert.equal(normalized.audioTracks[0].sha256,sha("approved-audio"));
  assert.throws(()=>normalizeWan22LaunchConfig({...config,wanRepoDir:"./Wan2.2"}),/launch_wan_repo_dir_required/);
  assert.throws(()=>normalizeWan22LaunchConfig({...config,checkpointSha256:"bad"}),/launch_checkpoint_sha256_required/);
  assert.throws(
    ()=>normalizeWan22LaunchConfig({...config,audioTracks:[{...config.audioTracks[0],uri:"https://example.com/music.wav"}]}),
    /launch_audio_local_uri_required:0/
  );
});

test("host preparation verifies audio checksum before hardware work",async()=>{
  const {config}=await fixture();
  let probed=false;
  await assert.rejects(()=>prepareWan22LaunchHost({
    ...config,
    audioTracks:[{...config.audioTracks[0],sha256:"f".repeat(64)}],
  },{
    ...hostDependencies(),
    probeHost:async()=>{probed=true;return {};},
  }),/launch_audio_checksum_mismatch:0/);
  assert.equal(probed,false);
});

test("host preparation refuses to overwrite final output or evidence",async()=>{
  const {config,finalOutputPath,evidenceOutputPath}=await fixture();
  await writeFile(finalOutputPath,"existing");
  await assert.rejects(
    ()=>prepareWan22LaunchHost(config,{...hostDependencies(),serviceFactory:()=>({})}),
    /launch_final_output_exists/
  );

  const second=await fixture();
  await writeFile(second.evidenceOutputPath,"existing");
  await assert.rejects(
    ()=>prepareWan22LaunchHost(second.config,{...hostDependencies(),serviceFactory:()=>({})}),
    /launch_evidence_output_exists/
  );

  assert.notEqual(finalOutputPath,evidenceOutputPath);
});

test("host preparation still wires the canonical local execution plan",async()=>{
  const {config}=await fixture();
  const calls=[];
  const fakeRunner={descriptor:{id:"wan22-ti2v-5b"},async health(){calls.push("runner-health");return {ok:true};}};
  const fakeAdapter={descriptor:{id:"wan22-ti2v-5b-local"},async health(){calls.push("adapter-health");return {ok:true};}};

  const host=await prepareWan22LaunchHost(config,{
    ...hostDependencies(),
    runnerFactory:options=>{calls.push(["runner",options.upstreamCommit]);return fakeRunner;},
    runtimeFactory:options=>{calls.push(["runtime",options.runtimeId]);return {};},
    adapterFactory:options=>{calls.push(["adapter",options.id]);return fakeAdapter;},
    serviceFactory:options=>{calls.push(["service",options.adapter===fakeAdapter]);return {};},
  });

  assert.equal(host.executionPlan.renderRequests.length,1);
  assert.equal(host.executionPlan.policy.commercialFallback,false);
  assert.ok(calls.includes("runner-health"));
  assert.ok(calls.includes("adapter-health"));
});

test("launch evidence records accepted evaluator result against exact render hash",async()=>{
  const {config}=await fixture();
  const artifactSha=sha("render-a");
  const finalBytes="final-video";
  const finalSha=sha(finalBytes);

  const fakeService={
    async start(plan){return {phase:"rendering",fingerprint:sha("s1"),executionPlanFingerprint:plan.fingerprint};},
    async awaitRenders(_plan,session){return {...session,phase:"renders_completed",fingerprint:sha("s2")};},
    async finalize({executionPlan,session,evaluate,assemblyRunner,outputPath}){
      assert.equal(session.phase,"renders_completed");
      const shot=executionPlan.storyboard.shots[0];
      const result=await evaluate({
        shot,
        request:executionPlan.renderRequests[0],
        route:executionPlan.routes[0],
        artifact:{
          uri:pathToFileURL(path.join(path.dirname(outputPath),"a.mp4")).href,
          sha256:artifactSha,
          sizeBytes:123,
          durationSeconds:2,
        },
      });
      assert.deepEqual(result,qualityResult);
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
    ...hostDependencies(),
    serviceFactory:()=>fakeService,
    qualityEvaluator:async()=>qualityResult,
    assemblyRunner:async(plan,{outputPath})=>{
      await writeFile(outputPath,finalBytes);
      return {evidence:{
        fingerprint:sha("assembly-evidence"),
        planFingerprint:plan.fingerprint,
        output:{uri:pathToFileURL(outputPath).href,sha256:finalSha,sizeBytes:finalBytes.length},
      }};
    },
  });

  assert.equal(result.status,"completed");
  assert.equal(result.evidenceBundle.finalOutputSha256,finalSha);
  assert.equal(result.evidenceBundle.evaluations.length,1);
  assert.equal(result.evidenceBundle.evaluations[0].shotId,"a");
  assert.equal(result.evidenceBundle.evaluations[0].artifactSha256,artifactSha);
  assert.deepEqual(result.evidenceBundle.evaluations[0].result,qualityResult);
  assert.match(result.evidenceBundle.evaluations[0].fingerprint,/^[a-f0-9]{64}$/);
});

test("launch rejects final file when disk hash differs from campaign evidence",async()=>{
  const {config}=await fixture();
  const actualBytes="actual-final";
  const fakeService={
    async start(){return {phase:"rendering",fingerprint:sha("s1")};},
    async awaitRenders(_plan,session){return {...session,phase:"renders_completed",fingerprint:sha("s2")};},
    async finalize({executionPlan,evaluate,outputPath}){
      const shot=executionPlan.storyboard.shots[0];
      await evaluate({
        shot,
        request:executionPlan.renderRequests[0],
        route:executionPlan.routes[0],
        artifact:{uri:"file:///tmp/a.mp4",sha256:sha("render"),sizeBytes:10,durationSeconds:2},
      });
      await writeFile(outputPath,actualBytes);
      return {
        session:{fingerprint:sha("session")},
        winners:{fingerprint:sha("winners")},
        assemblyPlan:{fingerprint:sha("assembly-plan")},
        assemblyResult:{evidence:{fingerprint:sha("assembly-evidence")}},
        campaignEvidence:{
          fingerprint:sha("campaign"),
          finalOutput:{uri:pathToFileURL(outputPath).href,sha256:sha("different-final"),sizeBytes:12},
        },
      };
    },
  };

  await assert.rejects(()=>executeWan22Launch(config,{
    ...hostDependencies(),
    serviceFactory:()=>fakeService,
    qualityEvaluator:async()=>qualityResult,
  }),/launch_final_output_checksum_mismatch/);
});

test("evidence bundle carries evaluations and independently verified final hash",()=> {
  const executionPlan={projectId:"x",fingerprint:sha("plan")};
  const finalization={
    session:{fingerprint:sha("session")},
    winners:{fingerprint:sha("winners")},
    assemblyPlan:{fingerprint:sha("assembly-plan")},
    assemblyResult:{evidence:{fingerprint:sha("assembly-evidence")}},
    campaignEvidence:{fingerprint:sha("campaign"),finalOutput:{sha256:sha("final")}},
  };
  const evaluations=[{shotId:"a",artifactSha256:sha("render"),result:qualityResult,fingerprint:sha("eval")}];
  const bundle=createLaunchEvidenceBundle({
    executionPlan,
    finalization,
    hardwareProbe:{eligible:true},
    config:{upstreamCommit:commit,checkpointSha256:sha("checkpoint")},
    evaluations,
    finalOutputSha256:sha("final"),
  });
  assert.equal(bundle.finalOutputSha256,sha("final"));
  assert.equal(bundle.evaluations[0].artifactSha256,sha("render"));
});

test("evidence export is exclusive-create and hashes exact serialized bytes",async()=>{
  const {root}=await fixture();
  const bundle={schema:"x",fingerprint:sha("bundle")};
  const output=path.join(root,"bundle.json");
  const first=await writeLaunchEvidenceBundle(bundle,output);
  const captured=await readFile(output);
  assert.equal(first.sizeBytes,captured.length);
  assert.equal(first.sha256,createHash("sha256").update(captured).digest("hex"));
  await assert.rejects(()=>writeLaunchEvidenceBundle(bundle,output),error=>{
    assert.equal(error.code,"EEXIST");
    return true;
  });
});

test("launch execution still refuses to invent quality evaluation",async()=>{
  const {config}=await fixture();
  await assert.rejects(()=>executeWan22Launch(config,{brief}),/launch_quality_evaluator_required/);
});
