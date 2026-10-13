#!/usr/bin/env node
// Local Hercules Cloud Host Engine operator (never a public listener).
// Requires an external owner-signed permit; never mints its own approvals.
// No network client, automatic host provisioning, or production rollout.
import {readFile,lstat,statfs} from "node:fs/promises";
import {cpus,arch,totalmem} from "node:os";
import {resolve,isAbsolute} from "node:path";
import {execFile,execFileSync} from "node:child_process";
import {assertSandboxHostPlan} from "./host-agent.mjs";
import {runHostEngineOperation} from "./host-engine.mjs";

const MAX_FILE=64*1024;
const sanitizedError=code=>{
 process.stderr.write(JSON.stringify({ok:false,code,productionAuthorized:false})+"\n");
 process.exitCode=1;
};
function safeAbsolute(value) {
 return typeof value==="string"&&isAbsolute(value)&&resolve(value)===value&&value!=="/";
}
async function readRestricted(path,uid,{asJson=true}={}){
 if(!safeAbsolute(path))throw Error("operator_file_path_invalid");
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.uid!==uid||(st.mode&0o077)!==0||
    st.size<=0||st.size>MAX_FILE)throw Error("operator_file_untrusted");
 const b=await readFile(path,{encoding:"utf8"});
 return asJson?JSON.parse(b):b.trim();
}
function machineInfo(osRelease){
 const id=(osRelease.match(/^ID=(.*)$/m)?.[1]??"").replaceAll('"',"");
 const version=(osRelease.match(/^VERSION_ID=(.*)$/m)?.[1]??"").replaceAll('"',"");
 return {id,version};
}
const cmd=process.argv[2];
if(process.env.HERCULES_HOST_ENGINE_SANDBOX_ENABLED!=="true") {
 sanitizedError("host_engine_disabled");
}else{
 try{
  if(!["start","rollback"].includes(cmd)||process.argv.length!==6)
   throw Error("operator_arguments_invalid");
  if(process.platform!=="linux")throw Error("host_linux_required");
  const uid=process.getuid?.();
  if(!Number.isInteger(uid)||uid<1000||uid>65535)throw Error("host_user_unverified");
  const [planPath,permitPath,root]=process.argv.slice(3);
  if(!safeAbsolute(root))throw Error("replay_vault_path_untrusted");
  const plan=await readRestricted(planPath,uid);
  const permit=await readRestricted(permitPath,uid);
  assertSandboxHostPlan(plan);
  if(uid!==plan.runtimeUid)throw Error("host_user_unverified");
  const socket="/run/user/"+uid+"/docker.sock";
  const socketStat=await lstat(socket);
  if(!socketStat.isSocket()||socketStat.uid!==uid||(socketStat.mode&0o077)!==0)
   throw Error("host_socket_unverified");
  const keyPath=process.env.HERCULES_HOST_ENGINE_OWNER_KEY_FILE;
  const signingKey=await readRestricted(keyPath,uid,{asJson:false});
  if(signingKey.length<32)throw Error("owner_verification_key_untrusted");

  const release=await readFile("/etc/os-release",{encoding:"utf8"});
  const os=machineInfo(release);
  const filesystem=await statfs("/");
  // Strict read-only local Docker daemon probe on an exact user-owned Unix
  // socket. The signed-permit executor rechecks this daemon before mutation.
  const info=execFileSync("/usr/bin/docker",
   ["--host","unix://"+socket,"info","--format","{{json .SecurityOptions}}"],{
     encoding:"utf8",timeout:8000,maxBuffer:8192,
     env:{PATH:"/usr/bin:/bin",HOME:"/nonexistent",LANG:"C",DOCKER_CONFIG:"/nonexistent"}
   });
  const options=JSON.parse(info.trim());
  const now=Date.now();
  const observation={
   osId:os.id,osVersion:os.version,architecture:arch(),
   logicalCpus:cpus().length,memoryBytes:totalmem(),
   availableDiskBytes:filesystem.bavail*filesystem.bsize,
   userUid:uid,dockerSocket:socket,dockerSocketType:"socket",
   dockerSocketOwnerUid:socketStat.uid,dockerSecurityOptions:options,observedAt:now
  };
  const result=await runHostEngineOperation({
   action:cmd,plan,permit,signingKey,root,observation,processUid:uid,
   socketStat,execFileImpl:execFile,enableSandbox:true,now
  });
  process.stdout.write(JSON.stringify(result)+"\n");
 }catch{
  // No raw paths, secrets, stack traces, plan contents or credentials in logs.
  sanitizedError("host_engine_unverified_or_action_denied");
 }
}
