import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,lstat,readFile,rm,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDurableNonceStore,createBoundedDockerRunner} from '../hercules-deploy/cloud/host-local.mjs';
import {createSandboxHostPlan,createSandboxPermit,executeSandboxHostPlan} from '../hercules-deploy/cloud/host-agent.mjs';

const now=Date.parse('2026-10-13T14:10:00Z');
const image='registry.example/hercules-smoke@sha256:'+'c'.repeat(64);
const manifest={
  serviceId:'hercules-smoke',releaseId:'smoke-r1',sourceCommit:'a'.repeat(40),
  artifactFingerprint:'b'.repeat(64),publicOrigin:'https://example.com',
  target:{kind:'owned_linux',reference:'sandbox-01'}
};
const host={
 kind:'owned_linux',reference:'sandbox-01',environment:'sandbox',
 verified:true,verifiedAt:'2026-10-13T14:09:00Z',runtime:'rootless_docker',
 runtimeUid:1000,incrementalMonthlyCostUsd:0,allowlistedImages:[image]
};
const plan=()=>createSandboxHostPlan(manifest,{targets:[host],image,now});
const nonce1='a'.repeat(32);
const nonce2='b'.repeat(32);
async function tempRoot(fn){
 const parent=await mkdtemp(join(tmpdir(),'hercules-cloud-nonce-'));
 try{return await fn(parent,join(parent,'replay'))}
 finally{await rm(parent,{recursive:true,force:true})}
}
test('exclusive durable nonce survives reopening the store and replays fail closed',()=>tempRoot(async(parent,root)=>{
 const first=await createDurableNonceStore({root});
 assert.equal(await first(nonce1,now+120000),true);
 const second=await createDurableNonceStore({root});
 assert.equal(await second(nonce1,now+120000),false);
 assert.equal(await second(nonce2,now+120000),true);
 const entries=await import('node:fs/promises').then(fs=>fs.readdir(root));
 assert.equal(entries.length,2);
 for(const name of entries){
  assert.match(name,/^[a-f0-9]{64}\.used$/);
  const item=await lstat(join(root,name));
  assert.equal(item.mode&0o077,0);
  const data=await readFile(join(root,name),'utf8');
  assert.equal(data.includes('signingKey'),false);
 }
 const dir=await lstat(root);
 assert.equal(dir.mode&0o077,0);
}));
test('two concurrent consumers cannot both execute the same grant',()=>tempRoot(async(parent,root)=>{
 const consume=await createDurableNonceStore({root});
 const results=await Promise.all(Array.from({length:24},()=>consume(nonce1,now+120000)));
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(results.filter(x=>x===false).length,23);
}));
test('untrusted nonce data cannot escape the replay vault',()=>tempRoot(async(parent,root)=>{
 const consume=await createDurableNonceStore({root});
 for(const key of ['../escape','ABCDEF','/'.repeat(32),'x'.repeat(32),'','a'.repeat(31)]){
  await assert.rejects(()=>consume(key,now+120000),/nonce_invalid/);
 }
 await assert.rejects(()=>consume(nonce1,Number.POSITIVE_INFINITY),/expiry_invalid/);
}));
test('symlink and public-readable replay directories are refused',()=>tempRoot(async(parent,root)=>{
 const other=join(parent,'other');await mkdir(other,{mode:0o700});
 await symlink(other,root);
 await assert.rejects(()=>createDurableNonceStore({root}),/store_untrusted/);
 await rm(root);
 await mkdir(root,{mode:0o700});
 await chmod(root,0o755);
 await assert.rejects(()=>createDurableNonceStore({root}),/store_untrusted/);
}));
test('local Docker runner pins exact Unix socket, args, binary and environment',async()=>{
 const operations=[];const p=plan();
 const runner=createBoundedDockerRunner(p,{execFileImpl:(file,args,opts,callback)=>{
   operations.push({file,args,opts});
   callback(null,'["name=rootless"]','');
 }});
 const info=await runner('docker',['--host',p.rootlessSocket,'info','--format','{{json .SecurityOptions}}'],{timeoutMs:10000,shell:false});
 assert.equal(info.exitCode,0);
 assert.equal(info.stdout,'["name=rootless"]');
 assert.equal(operations.length,1);
 assert.equal(operations[0].file,'/usr/bin/docker');
 assert.deepEqual(operations[0].args.slice(0,2),['--host','unix:///run/user/1000/docker.sock']);
 assert.equal(operations[0].opts.shell,false);
 assert.equal(operations[0].opts.timeout,10000);
 assert.equal(operations[0].opts.maxBuffer<=65536,true);
 assert.equal(operations[0].opts.env.DOCKER_HOST,undefined);
 assert.equal(operations[0].opts.env.DOCKER_CONFIG,'/nonexistent');
});
test('no arbitrary subprocess, network command, extra Docker args or hostile plan',async()=>{
 const operations=[];const p=plan();
 const runner=createBoundedDockerRunner(p,{execFileImpl:(file,args,opts,cb)=>{operations.push(args);cb(null,'','')}});
 const good=['docker','--host',p.rootlessSocket,...p.commands.create];
 for(const [file,args] of [
  ['sh',['-c','id']],
  ['docker',['--host','tcp://127.0.0.1:2375',...p.commands.start]],
  ['docker',['--host',p.rootlessSocket,'container','run','--privileged',image]],
  ['docker',['--host',p.rootlessSocket,...p.commands.create,'--privileged']],
  ['docker',['--host',p.rootlessSocket,'container','rm','--force','other-app']],
  ['docker',['--host',p.rootlessSocket,'info']],
 ]){
  await assert.rejects(()=>runner(file,args,{shell:false}),/command_not_allowlisted/);
 }
 assert.equal(operations.length,0);
 assert.throws(()=>createBoundedDockerRunner({...p,commands:{...p.commands,start:['container','start','other-app']}}),/plan_integrity_invalid/);
 await runner(good[0],good.slice(1),{shell:false});
 assert.equal(operations.length,1);
});
test('command subprocess errors fail closed without leaking stderr, tokens or unbounded output',async()=>{
 const p=plan();
 const runner=createBoundedDockerRunner(p,{execFileImpl:(file,args,opts,callback)=>{
  const err=Object.assign(new Error('SECRET-IN-ERROR'),{code:127});
  callback(err,'SECRET-STDOUT','SECRET-STDERR');
 }});
 const result=await runner('docker',['--host',p.rootlessSocket,...p.commands.start],{shell:false});
 assert.equal(result.exitCode!==0,true);
 assert.equal(result.stdout,'');
 assert.equal(JSON.stringify(result).includes('SECRET'),false);
});

test('no executable host bridge exists without a separately authorized runner',()=>{
 assert.throws(()=>createBoundedDockerRunner(plan()),/local_command_executor_not_injected/);
});

test('signed deployment grant and real disk replay marker compose with synthetic rootless commands',()=>tempRoot(async(parent,root)=>{
 const p=plan(),grant='s'.repeat(40);
 const permit=createSandboxPermit(p,{signingKey:grant,now,ttlMs:120000});
 let mutatingCommands=0;
 const runner=createBoundedDockerRunner(p,{execFileImpl:(file,args,opts,callback)=>{
  if(args[2]==='info')return callback(null,'["name=rootless"]','');
  mutatingCommands++;
  if(args[3]==='inspect')return callback(null,'true','');
  return callback(null,'','');
 }});
 const first=await createDurableNonceStore({root});
 const receipt=await executeSandboxHostPlan(p,{
  permit,signingKey:grant,now,runCommand:runner,consumeNonce:first
 });
 assert.equal(receipt.runningVerified,true);
 assert.equal(receipt.productionAuthorized,false);
 assert.equal(mutatingCommands,3);
 const reopened=await createDurableNonceStore({root});
 await assert.rejects(()=>executeSandboxHostPlan(p,{
  permit,signingKey:grant,now,runCommand:runner,consumeNonce:reopened
 }),/permit_replayed/);
 assert.equal(mutatingCommands,3);
}));
