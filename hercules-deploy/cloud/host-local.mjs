// Local-only Hercules Cloud adapter: not wired to any public API or deployed host.
// An independent owner-controlled operator must authorize each signed action.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {mkdir,lstat,open,realpath} from 'node:fs/promises';
import {isAbsolute,join,normalize,resolve} from 'node:path';
import {assertSandboxHostPlan} from './host-agent.mjs';

const NONCE=/^[a-f0-9]{32}$/;
const INFO=Object.freeze(['info','--format','{{json .SecurityOptions}}']);
const EXEC_TIMEOUT_MS=10000;
const EXEC_MAX_BUFFER=65536;

function fail(code){throw new Error(code)}
async function verifyVault(root){
 let entry,real;
 try{
  entry=await lstat(root);
  real=await realpath(root);
 }catch{fail('store_untrusted')}
 if(!entry.isDirectory()||entry.isSymbolicLink()
   ||(entry.mode&0o077)!==0||real!==root
   ||(typeof process.getuid==='function'&&entry.uid!==process.getuid()))
   fail('store_untrusted');
}
export async function createDurableNonceStore({root}={}){
 if(typeof root!=='string'||!isAbsolute(root)||root==='/'||root!==normalize(root)||root!==resolve(root))
   fail('store_untrusted');
 try{await mkdir(root,{mode:0o700})}
 catch(error){if(error?.code!=='EEXIST')fail('store_untrusted')}
 await verifyVault(root);
 return async function consumeNonce(nonce,expiresAt){
  if(typeof nonce!=='string'||!NONCE.test(nonce))fail('nonce_invalid');
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=0)fail('expiry_invalid');
  await verifyVault(root);
  // Exclusive file creation is a single atomic winner across worker processes.
  // A truncated marker after a crash still permanently blocks replay (fail closed).
  const marker=join(root,createHash('sha256').update(nonce).digest('hex')+'.used');
  let file;
  try{
   file=await open(marker,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  }catch(error){
   if(error?.code==='EEXIST')return false;
   fail('replay_store_unavailable');
  }
  try{
   await file.writeFile(JSON.stringify({
    schema:'hercules.cloud.replay-marker.v1',
    expiresAt,
    consumed:true
   })+'\n');
   await file.sync();
  }catch{fail('replay_store_unavailable')}
  finally{await file.close()}
  // Persist the new directory entry before authorizing any Docker operation.
  let directory;
  try{
   directory=await open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
   await directory.sync();
  }catch{fail('replay_store_unavailable')}
  finally{await directory?.close()}
  return true;
 };
}
export function createBoundedDockerRunner(plan,{execFileImpl}={}){
 assertSandboxHostPlan(plan);
 if(typeof execFileImpl!=='function')fail('local_command_executor_not_injected');
 const socket=plan.rootlessSocket;
 if(!/^unix:\/\/\/run\/user\/(?:[1-9]\d{3,4})\/docker\.sock$/.test(socket))
   fail('plan_integrity_invalid');
 const commands=[INFO,...Object.values(plan.commands)];
 const allowed=new Set(commands.map(x=>JSON.stringify(x)));
 return async function runCommand(file,args,opts={}){
  const exact=Array.isArray(args)?args.slice(2):null;
  if(file!=='docker'||!Array.isArray(args)||args[0]!=='--host'
    ||args[1]!==socket||!allowed.has(JSON.stringify(exact))
    ||opts?.shell!==false&&opts?.shell!==undefined
    ||opts?.timeoutMs>EXEC_TIMEOUT_MS)fail('command_not_allowlisted');
  const safeArgs=['--host',socket,...exact];
  return await new Promise(resolveResult=>{
   const options={
    encoding:'utf8',
    shell:false,
    timeout:EXEC_TIMEOUT_MS,
    killSignal:'SIGKILL',
    maxBuffer:EXEC_MAX_BUFFER,
    windowsHide:true,
    env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C',DOCKER_CONFIG:'/nonexistent'}
   };
   try{
    execFileImpl('/usr/bin/docker',safeArgs,options,(error,stdout)=>{
     if(error)return resolveResult({exitCode:1,stdout:''});
     return resolveResult({
      exitCode:0,
      stdout:typeof stdout==='string'?stdout.slice(0,EXEC_MAX_BUFFER):''
     });
    });
   }catch{return resolveResult({exitCode:1,stdout:''})}
  });
 };
}
