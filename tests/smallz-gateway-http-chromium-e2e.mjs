import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const gateway=resolve(root,'hercules-browser-gateway-v2/server.mjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function freePort(){
  const server=createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}

test('real Smallz gateway HTTP and Chromium: auth, browser render, SSRF and session cleanup', {timeout:90000},async t=>{
  const port=await freePort();
  const token=randomBytes(32).toString('hex');
  const origin='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,[gateway],{
    cwd:root,
    env:{...process.env,PORT:String(port),HERCULES_GATEWAY_TOKEN:token},
    stdio:['ignore','pipe','pipe']
  });
  let output='';
  child.stdout.on('data',chunk=>{output+=String(chunk).slice(0,1000);});
  child.stderr.on('data',chunk=>{output+=String(chunk).slice(0,1000);});
  t.after(async()=>{
    if(child.exitCode===null)child.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(5000)]);
    if(child.exitCode===null)child.kill('SIGKILL');
  });
  let healthy=false;
  for(let attempt=0;attempt<100;attempt++){
    if(child.exitCode!==null)break;
    try{
      const response=await fetch(origin+'/health',{signal:AbortSignal.timeout(800)});
      if(response.ok){healthy=true;break;}
    }catch{}
    await sleep(150);
  }
  assert.equal(healthy,true,'gateway failed to start: '+output.slice(0,700));
  const post=async(body,authorization)=>fetch(origin+'/v1/run',{
    method:'POST',
    headers:{'content-type':'application/json',...(authorization?{authorization}: {})},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(20000)
  });
  const noAuth=await post({action:'navigate'});
  assert.equal(noAuth.status,401);
  const wrongAuth=await post({action:'navigate'},'Bearer wrong');
  assert.equal(wrongAuth.status,401);
  const auth='Bearer '+token;
  const privateTarget=await post({action:'navigate',url:'http://127.0.0.1:5432/admin'},auth);
  assert.equal(privateTarget.status,400);
  assert.equal((await privateTarget.json()).error,'private_target_blocked');
  const embeddedCredentials=await post({action:'navigate',url:'https://owner:secret@example.org/'},auth);
  assert.equal(embeddedCredentials.status,400);
  assert.equal((await embeddedCredentials.json()).error,'embedded_credentials_blocked');
  const invalidAction=await post({action:'arbitrary_script'},auth);
  assert.equal(invalidAction.status,400);
  assert.equal((await invalidAction.json()).error,'unsupported_action');

  // No external site: the real Chromium page is about:blank.
  const launched=await post({action:'navigate',persistSession:true},auth);
  assert.equal(launched.status,200,'Chromium launch failed: '+await launched.clone().text());
  const result=await launched.json();
  assert.equal(result.ok,true);
  assert.equal(result.page.url,'about:blank');
  assert.equal(typeof result.sessionId,'string');
  assert.ok(result.sessionId.length>0);
  const reused=await post({action:'scrape',sessionId:result.sessionId,selectors:[]},auth);
  assert.equal(reused.status,200);
  const reusedBody=await reused.json();
  assert.equal(reusedBody.sessionId,result.sessionId);
  assert.equal(reusedBody.page.url,'about:blank');
  const closed=await post({action:'close_session',sessionId:result.sessionId},auth);
  assert.equal(closed.status,200);
  assert.equal((await closed.json()).closed,true);
});
