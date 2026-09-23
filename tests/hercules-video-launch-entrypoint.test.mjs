import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp,mkdir,readFile,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {
  normalizeLaunchConfig,
  validateLaunchInputs,
  runLocalEvaluator,
  runHerculesLaunch,
} from "../hercules-video/launch-hercules.mjs";

const sha=value=>createHash("sha256").update(value).digest("hex");

async function fixture({withAudio=true}={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),"hercules-launch-"));
  const wanRepoDir=path.join(root,"wan");
  const checkpointDir=path.join(root,"checkpoint");
  const renderOutputDir=path.join(root,"renders");
  await Promise.all([mkdir(wanRepoDir),mkdir(checkpointDir),mkdir(renderOutputDir)]);

  const audioPath=path.join(root,"music.wav");
  await writeFile(audioPath,"approved-audio");

  const finalOutputPath=path.join(root,"final.mp4");
  const config={
    projectId:"launch-test",
    wanRepoDir,
    checkpointDir,
    checkpointSha256:"a".repeat(64),
    upstreamCommit:"b".repeat(40),
    renderOutputDir,
    finalOutputPath,
    evidenceOutputPath:finalOutputPath+".evidence.json",
    minimumScore:.7,
    maxPolls:3,
    pollIntervalMs:0,
    audioTracks:withAudio ? [{
      id:"music",
      kind:"soundtrack",
      path:audioPath,
      startSeconds:0,
      durationSeconds:25,
      gainDb:-8,
      sha256:sha("approved-audio"),
    }] : [],
  };
  return {root,config,audioPath,finalOutputPath};
}

const quality={"promptAdherence":0.9,"temporalConsistency":0.9,"visualQuality":0.9,"brandConsistency":0.9,"audioQuality":0.8,"artifactFreedom":0.9,"reliability":0.95};

test("launch config defaults to the canonical Hercules preset",async()=>{
  const {config}=await fixture();
  const normalized=normalizeLaunchConfig(config);
  assert.match(normalized.presetPath,/hercules-video[\\/]presets[\\/]hercules-launch\.json$/);
  await validateLaunchInputs(config,{requireEvaluator:false});
});

test("launch config rejects a noncanonical preset override",async()=>{
  const {root,config}=await fixture();
  const other=path.join(root,"other.json");
  await writeFile(other,JSON.stringify({title:"other"}));
  await assert.rejects(
    ()=>validateLaunchInputs({...config,presetPath:other},{requireEvaluator:false}),
    /launch_preset_must_be_canonical/
  );
});

test("launch validation rejects an audio checksum mismatch",async()=>{
  const {config}=await fixture();
  config.audioTracks[0].sha256="c".repeat(64);
  await assert.rejects(
    ()=>validateLaunchInputs(config,{requireEvaluator:false}),
    /launch_audio_checksum_mismatch:0/
  );
});

test("launch validation prevents overwriting an existing final artifact",async()=>{
  const {config,finalOutputPath}=await fixture();
  await writeFile(finalOutputPath,"existing");
  await assert.rejects(
    ()=>validateLaunchInputs(config,{requireEvaluator:false}),
    /launch_final_output_exists/
  );
});

test("local evaluator receives post-render artifact context and returns bound evidence",async()=>{
  const {root}=await fixture();
  const script=path.join(root,"evaluate.mjs");
  await writeFile(script,`
    let input="";
    process.stdin.on("data",chunk=>input+=chunk);
    process.stdin.on("end",()=>{
      const request=JSON.parse(input);
      process.stdout.write(JSON.stringify({
        artifactSha256:request.artifact.sha256,
        method:"fixture-metrics-v1",
        evaluatorId:"fixture-evaluator",
        quality:{"promptAdherence":0.9,"temporalConsistency":0.9,"visualQuality":0.9,"brandConsistency":0.9,"audioQuality":0.8,"artifactFreedom":0.9,"reliability":0.95}
      }));
    });
  `);
  const artifactSha=sha("render-a");
  const result=await runLocalEvaluator({
    command:process.execPath,
    args:[script],
    timeoutMs:5000,
    context:{
      shot:{id:"a",prompt:"test"},
      request:{requestFingerprint:sha("request")},
      artifact:{uri:"file:///tmp/a.mp4",sha256:artifactSha,sizeBytes:10},
      route:{status:"routed"},
    },
  });
  assert.equal(result.artifactSha256,artifactSha);
  assert.equal(result.method,"fixture-metrics-v1");
});

test("launch fails before render execution when canonical post-audio is not supplied",async()=>{
  const {config}=await fixture({withAudio:false});
  const service={
    async start(){ throw new Error("should_not_start"); },
  };
  await assert.rejects(
    ()=>runHerculesLaunch(config,{
      evaluate:async()=>({artifactSha256:"0".repeat(64),method:"unused",quality}),
      probeHardware:async()=>({eligible:true}),
      runner:{descriptor:{id:"fixture-runner"}},
      runtime:{},
      adapter:{},
      service,
    }),
    /launch_post_audio_required/
  );
});

test("launch runs the canonical plan, records every measured evaluation, and verifies final output",async()=>{
  const {config,finalOutputPath}=await fixture();
  const runner={descriptor:{id:"fixture-runner"}};

  const service={
    async start(executionPlan){
      return {schema:"fixture-session",phase:"rendering",fingerprint:sha(executionPlan.fingerprint+"-start")};
    },
    async awaitRenders(executionPlan,session){
      return {...session,phase:"renders_completed",fingerprint:sha(executionPlan.fingerprint+"-rendered")};
    },
    async finalize({executionPlan,evaluate,outputPath}){
      for (const shot of executionPlan.storyboard.shots) {
        const request=executionPlan.renderRequests.find(item=>item.shot.id===shot.id);
        const route=executionPlan.routes.find(item=>item.shotId===shot.id);
        const artifact={
          uri:pathToFileURL(path.join(path.dirname(outputPath),shot.id+".mp4")).href,
          sha256:sha(shot.id),
          sizeBytes:100,
          durationSeconds:shot.durationSeconds,
        };
        await evaluate({shot,request,artifact,route});
      }
      await writeFile(outputPath,"final-video");
      return {
        session:{fingerprint:sha("final-session")},
        campaignEvidence:{
          fingerprint:sha("campaign-evidence"),
          finalOutput:{
            uri:pathToFileURL(outputPath).href,
            mimeType:"video/mp4",
            sizeBytes:11,
            sha256:sha("final-video"),
          },
        },
      };
    },
  };

  const result=await runHerculesLaunch(config,{
    probeHardware:async()=>({eligible:true}),
    runner,
    runtime:{},
    adapter:{},
    service,
    evaluate:async ({shot,artifact})=>({
      artifactSha256:artifact.sha256,
      method:"measured-fixture-v1",
      evaluatorId:"fixture-evaluator",
      quality:{...quality,audioQuality:shot.audioStrategy==="post" ? .7 : .8},
    }),
    assemblyRunner:async()=>{throw new Error("service_fixture_owns_finalize");},
  });

  assert.equal(result.outputPath,finalOutputPath);
  assert.equal(result.launchEvidence.finalOutputSha256,sha("final-video"));
  assert.equal(result.launchEvidence.evaluations.length,6);
  assert.deepEqual(
    result.launchEvidence.evaluations.map(record=>record.shotId),
    ["proof-awakens","forge-route","verification","trading-proof","recover","hero-lockup"]
  );
  assert.equal(result.launchEvidence.inputs.evaluation.kind,"injected");
  assert.match(result.launchEvidence.inputs.presetSha256,/^[a-f0-9]{64}$/);
  assert.match(result.launchEvidence.fingerprint,/^[a-f0-9]{64}$/);

  const saved=JSON.parse(await readFile(config.evidenceOutputPath,"utf8"));
  assert.equal(saved.fingerprint,result.launchEvidence.fingerprint);
  assert.equal(saved.campaignEvidence.fingerprint,sha("campaign-evidence"));
});

test("launch rejects a final file that does not match campaign evidence",async()=>{
  const {config}=await fixture();
  const service={
    async start(){return {fingerprint:sha("start")};},
    async awaitRenders(_plan,session){return {...session,fingerprint:sha("rendered")};},
    async finalize({executionPlan,evaluate,outputPath}){
      for (const shot of executionPlan.storyboard.shots) {
        const request=executionPlan.renderRequests.find(item=>item.shot.id===shot.id);
        const route=executionPlan.routes.find(item=>item.shotId===shot.id);
        const artifact={uri:"file:///tmp/"+shot.id+".mp4",sha256:sha(shot.id),sizeBytes:1,durationSeconds:shot.durationSeconds};
        await evaluate({shot,request,artifact,route});
      }
      await writeFile(outputPath,"actual-final");
      return {
        session:{fingerprint:sha("session")},
        campaignEvidence:{
          fingerprint:sha("campaign"),
          finalOutput:{uri:pathToFileURL(outputPath).href,sizeBytes:12,sha256:sha("different-final")},
        },
      };
    },
  };

  await assert.rejects(()=>runHerculesLaunch(config,{
    probeHardware:async()=>({eligible:true}),
    runner:{descriptor:{id:"fixture-runner"}},
    runtime:{},
    adapter:{},
    service,
    evaluate:async ({artifact})=>({
      artifactSha256:artifact.sha256,
      method:"fixture",
      evaluatorId:"fixture",
      quality,
    }),
  }),/launch_final_output_checksum_mismatch/);
});
