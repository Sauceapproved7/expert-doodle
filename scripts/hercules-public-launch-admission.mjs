import {readFile, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {evaluateReleaseGate} from "./hercules-release-gate.mjs";

const COMMIT=/^[a-f0-9]{40}$/;
const MAX_AGE_MS=60*60*1000;
const FUTURE_SKEW_MS=60*1000;
const MAX_PACKET_BYTES=64*1024;
const repoRoot=path.resolve(fileURLToPath(new URL("../",import.meta.url)));

export function evaluatePublicLaunchAdmission(packet, {expectedCommit, now=Date.now()}={}) {
  const evidence=packet?.evidence;
  const result=evaluateReleaseGate(evidence);
  const blockers=[];

  if(packet?.schema!=="sauceapproved.hercules.public-launch-admission" || packet?.version!==1) {
    blockers.push("admission.schema");
  }
  if(packet?.environment!=="production") blockers.push("admission.environment");

  if(
    !COMMIT.test(String(expectedCommit??"")) ||
    !COMMIT.test(String(packet?.sourceCommit??"")) ||
    packet.sourceCommit!==expectedCommit
  ) {
    blockers.push("admission.sourceCommit");
  }

  const checkedAt=packet?.checkedAt;
  const checkedMillis=typeof checkedAt==="string" ? Date.parse(checkedAt) : NaN;
  const instant=Number(now);
  if(
    !Number.isFinite(checkedMillis) ||
    !Number.isFinite(instant) ||
    typeof checkedAt!=="string" ||
    new Date(checkedMillis).toISOString()!==checkedAt ||
    instant-checkedMillis>MAX_AGE_MS ||
    checkedMillis-instant>FUTURE_SKEW_MS
  ) {
    blockers.push("admission.checkedAt");
  }
  if(!evidence || typeof evidence!=="object" || Array.isArray(evidence)) {
    blockers.push("admission.evidence");
  }

  blockers.push(...result.blockers);
  const ok=blockers.length===0;
  return {
    schema:"sauceapproved.hercules.public-launch-admission-result",
    version:1,
    ok,
    eligibleForPublicRelease:ok,
    sourceCommit:COMMIT.test(String(packet?.sourceCommit??""))?packet.sourceCommit:null,
    checkedAt:typeof checkedAt==="string"?checkedAt:null,
    blockers,
  };
}

export async function evaluatePublicLaunchAdmissionFile(evidencePath, expectedCommit, {now=Date.now()}={}) {
  if(!COMMIT.test(String(expectedCommit??""))) throw new Error("expected_commit_invalid");
  const allowedPath=path.join(repoRoot,"releases","public-launch","evidence.json");
  if(path.resolve(String(evidencePath??""))!==allowedPath) throw new Error("evidence_path_must_match_release_commit");
  const metadata=await stat(allowedPath);
  if(!metadata.isFile() || metadata.size>MAX_PACKET_BYTES) throw new Error("evidence_file_invalid");
  const packet=JSON.parse(await readFile(allowedPath,"utf8"));
  return evaluatePublicLaunchAdmission(packet,{expectedCommit,now});
}

async function main() {
  const args=process.argv.slice(2);
  const evidencePath=args[args.indexOf("--evidence")+1];
  const expectedCommit=args[args.indexOf("--commit")+1];
  if(!args.includes("--evidence") || !args.includes("--commit") ||
     !evidencePath || !expectedCommit) {
    throw new Error("usage: node scripts/hercules-public-launch-admission.mjs --evidence releases/public-launch/evidence.json --commit <parent-source-sha>");
  }
  const result=await evaluatePublicLaunchAdmissionFile(evidencePath,expectedCommit);
  console.log(JSON.stringify(result,null,2));
  if(!result.ok) process.exitCode=1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{
    console.error("public_launch_admission_failed:",error.message);
    process.exitCode=1;
  });
}
