import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {mkdir, readFile, rename, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {fingerprint} from "./core.mjs";
import {validateCampaignExecutionSession} from "./campaign-execution-service.mjs";

function requireAbsolute(value,code) {
  const raw=String(value || "");
  if (!raw || !path.isAbsolute(raw)) throw new Error(code);
  return path.normalize(raw);
}

function requireSha256(value,code) {
  const raw=String(value || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(raw)) throw new Error(code);
  return raw;
}

async function sha256File(filePath) {
  return new Promise((resolve,reject)=>{
    const hash=createHash("sha256");
    const stream=createReadStream(filePath);
    stream.on("error",reject);
    stream.on("data",chunk=>hash.update(chunk));
    stream.on("end",()=>resolve(hash.digest("hex")));
  });
}

function identityFor(executionPlan,config) {
  return {
    executionPlanFingerprint:String(executionPlan?.fingerprint || ""),
    upstreamCommit:String(config?.upstreamCommit || ""),
    checkpointSha256:String(config?.checkpointSha256 || "").toLowerCase(),
    runtimeId:String(config?.runtimeId || ""),
    renderOutputDir:requireAbsolute(config?.renderOutputDir,"launch_state_render_output_dir_required"),
    finalOutputPath:requireAbsolute(config?.finalOutputPath,"launch_state_final_output_path_required"),
    evidenceOutputPath:requireAbsolute(config?.evidenceOutputPath,"launch_state_evidence_output_path_required"),
  };
}

function seal(unsigned) {
  return {...unsigned,fingerprint:fingerprint(unsigned)};
}

export function createLaunchRunState({
  executionPlan,
  config,
  session,
  stage="rendering",
  evaluations=[],
  finalOutputSha256=null,
  campaignEvidenceFingerprint=null,
}) {
  validateCampaignExecutionSession(session);
  const identity=identityFor(executionPlan,config);
  if (!identity.executionPlanFingerprint) throw new Error("launch_state_execution_plan_fingerprint_required");
  if (session.executionPlanFingerprint!==identity.executionPlanFingerprint) {
    throw new Error("launch_state_session_plan_mismatch");
  }
  if (!["rendering","finalizing","completed","failed"].includes(stage)) {
    throw new Error("launch_state_stage_invalid");
  }
  const unsigned={
    schema:"sauceapproved.hercules.video-launch-run-state",
    version:1,
    identity,
    stage,
    session:structuredClone(session),
    evaluations:structuredClone(evaluations),
    finalOutputSha256:finalOutputSha256 ? requireSha256(finalOutputSha256,"launch_state_final_output_sha256_invalid") : null,
    campaignEvidenceFingerprint:campaignEvidenceFingerprint
      ? requireSha256(campaignEvidenceFingerprint,"launch_state_campaign_evidence_fingerprint_invalid")
      : null,
  };
  return seal(unsigned);
}

export function validateLaunchRunState(state,{executionPlan,config}={}) {
  if (!state || typeof state!=="object") throw new Error("launch_state_required");
  const supplied=String(state.fingerprint || "");
  const unsigned={...state};
  delete unsigned.fingerprint;
  if (!supplied || fingerprint(unsigned)!==supplied) throw new Error("launch_state_fingerprint_mismatch");
  if (state.schema!=="sauceapproved.hercules.video-launch-run-state" || Number(state.version)!==1) {
    throw new Error("launch_state_schema_invalid");
  }
  validateCampaignExecutionSession(state.session);
  const expected=identityFor(executionPlan,config);
  for (const key of Object.keys(expected)) {
    if (state.identity?.[key]!==expected[key]) throw new Error("launch_state_identity_mismatch:" + key);
  }
  if (state.session.executionPlanFingerprint!==expected.executionPlanFingerprint) {
    throw new Error("launch_state_session_plan_mismatch");
  }
  if (!Array.isArray(state.evaluations)) throw new Error("launch_state_evaluations_invalid");
  return state;
}

export async function verifyLaunchRunStateArtifacts(state) {
  validateCampaignExecutionSession(state?.session);
  const completed=new Map();
  for (const job of state.session.jobs) {
    if (job.status!=="completed") continue;
    if (!job.artifact) throw new Error("launch_state_completed_artifact_missing:" + job.shotId);
    const uri=String(job.artifact.uri || "");
    if (!uri.startsWith("file://")) throw new Error("launch_state_completed_artifact_not_local:" + job.shotId);
    const filePath=fileURLToPath(uri);
    const info=await stat(filePath).catch(()=>null);
    if (!info?.isFile() || info.size<=0) throw new Error("launch_state_completed_artifact_file_missing:" + job.shotId);
    const expected=requireSha256(job.artifact.sha256,"launch_state_completed_artifact_sha256_invalid:" + job.shotId);
    const actual=await sha256File(filePath);
    if (actual!==expected) throw new Error("launch_state_completed_artifact_checksum_mismatch:" + job.shotId);
    completed.set(job.shotId,expected);
  }

  const seen=new Set();
  for (const evaluation of state.evaluations || []) {
    const shotId=String(evaluation?.shotId || "");
    if (!shotId || seen.has(shotId)) throw new Error("launch_state_evaluation_duplicate_or_missing_shot");
    seen.add(shotId);
    const evaluationFingerprint=String(evaluation?.fingerprint || "");
    const evaluationUnsigned={...evaluation};
    delete evaluationUnsigned.fingerprint;
    if (!evaluationFingerprint || fingerprint(evaluationUnsigned)!==evaluationFingerprint) {
      throw new Error("launch_state_evaluation_fingerprint_mismatch:" + shotId);
    }
    const artifactSha256=requireSha256(
      evaluation?.artifactSha256,
      "launch_state_evaluation_artifact_sha256_invalid:" + shotId
    );
    const completedSha=completed.get(shotId);
    if (!completedSha) throw new Error("launch_state_evaluation_without_completed_artifact:" + shotId);
    if (artifactSha256!==completedSha) throw new Error("launch_state_evaluation_artifact_mismatch:" + shotId);
  }
  return state;
}

export async function readLaunchRunState(filePath,{readFileImpl=readFile}={}) {
  const absolute=requireAbsolute(filePath,"launch_state_path_required");
  const parsed=JSON.parse(await readFileImpl(absolute,"utf8"));
  return parsed;
}

export async function writeLaunchRunStateAtomic(
  state,
  filePath,
  {
    mkdirImpl=mkdir,
    writeFileImpl=writeFile,
    renameImpl=rename,
  }={}
) {
  const absolute=requireAbsolute(filePath,"launch_state_path_required");
  const supplied=String(state?.fingerprint || "");
  if (!supplied) throw new Error("launch_state_fingerprint_required");
  const unsigned={...state};
  delete unsigned.fingerprint;
  if (fingerprint(unsigned)!==supplied) throw new Error("launch_state_fingerprint_mismatch");

  await mkdirImpl(path.dirname(absolute),{recursive:true});
  const tempPath=absolute + ".tmp-" + process.pid + "-" + supplied.slice(0,12);
  const bytes=Buffer.from(JSON.stringify(state,null,2)+"\n","utf8");
  await writeFileImpl(tempPath,bytes,{flag:"wx"});
  await renameImpl(tempPath,absolute);
  return {
    path:absolute,
    sizeBytes:bytes.length,
    sha256:createHash("sha256").update(bytes).digest("hex"),
    stateFingerprint:supplied,
  };
}
