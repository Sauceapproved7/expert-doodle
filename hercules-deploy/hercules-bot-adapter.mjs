import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,relative,join} from "node:path";

function safeTarget(root,reference){
 const base=resolve(root);
 const target=resolve(base,reference);
 const rel=relative(base,target);
 if(rel.startsWith(".."+"/")||rel===".."||rel.includes("\0")||rel.includes("\\")){
  throw new Error("target reference must remain inside allowed root");
 }
 return target;
}

export class HerculesBotDeployTargetAdapter{
 constructor({allowedRoot}={}) {
  if(!allowedRoot) throw new TypeError("allowedRoot is required");
  this.allowedRoot=resolve(allowedRoot);
  this.active=new Map();
 }
 async deploy({deploymentId,request}){
  if(request.target.kind!=="hercules_bot_local") throw new Error("invalid Hercules Bot target kind");
  const targetDir=safeTarget(this.allowedRoot,request.target.reference);
  await mkdir(targetDir,{recursive:true});
  const manifest={
   schema:"hercules.bot.release.v1",
   serviceId:request.serviceId,
   releaseId:request.releaseId,
   sourceCommit:request.sourceCommit,
   artifactFingerprint:request.artifactFingerprint,
   publicOrigin:request.publicOrigin,
   runtimeMode:"software-only",
   hardwareConnected:false,
   emergencyStop:true
  };
  await writeFile(join(targetDir,"hercules-release.json"),JSON.stringify(manifest,null,2)+"\n",{encoding:"utf8",mode:0o600});
  this.active.set(deploymentId,Object.freeze({targetDir,manifest}));
  return {targetKind:request.target.kind,targetReference:request.target.reference,releaseId:request.releaseId,verifiedReady:false,runtimeMode:"software-only"};
 }
 async verify({deploymentId,request}){
  const current=this.active.get(deploymentId);
  if(!current) throw Object.assign(new Error("deployment_not_active"),{code:"deployment_not_active"});
  const manifest=JSON.parse(await readFile(join(current.targetDir,"hercules-release.json"),"utf8"));
  if(manifest.releaseId!==request.releaseId||manifest.artifactFingerprint!==request.artifactFingerprint||manifest.sourceCommit!==request.sourceCommit){
   throw Object.assign(new Error("release_manifest_mismatch"),{code:"release_manifest_mismatch"});
  }
  return {verified:true,releaseId:manifest.releaseId,sourceCommit:manifest.sourceCommit,artifactFingerprint:manifest.artifactFingerprint,publicOrigin:manifest.publicOrigin,runtimeMode:manifest.runtimeMode,hardwareConnected:false,emergencyStop:true};
 }
 async rollback({deploymentId,request}){
  const current=this.active.get(deploymentId);
  this.active.delete(deploymentId);
  return {rolledBack:Boolean(current),releaseId:request.releaseId};
 }
}
