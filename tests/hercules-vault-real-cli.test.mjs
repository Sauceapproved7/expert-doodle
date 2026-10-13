import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:net";
import {spawn} from "node:child_process";
import {randomBytes} from "node:crypto";
import {fileURLToPath} from "node:url";

const cli=fileURLToPath(new URL("../hercules-vault/control-cli.mjs",import.meta.url));
const TOKEN=randomBytes(32).toString("hex");
async function ephemeralPort(){
 const server=createServer();
 await new Promise((resolve,reject)=>server.once("error",reject).listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
async function openRealCli(){
 const port=await ephemeralPort();
 const process=spawn(globalThis.process.execPath,[cli],{
  env:{...globalThis.process.env,HERCULES_VAULT_ASSISTANT_ENABLED:"true",
   HERCULES_VAULT_ASSISTANT_TOKEN:TOKEN,HERCULES_VAULT_HOST:"127.0.0.1",
   PORT:String(port)},
  stdio:["ignore","pipe","pipe"]
 });
 let output="",errors="";
 process.stdout.on("data",b=>{output+=b.toString("utf8").slice(0,600)});
 process.stderr.on("data",b=>{errors+=b.toString("utf8").slice(0,600)});
 const url="http://127.0.0.1:"+port;
 const deadline=Date.now()+25000;
 while(Date.now()<deadline){
  if(process.exitCode!==null)throw Error("Vault CLI exited before health: "+errors.slice(0,160));
  try {
   const r=await fetch(url+"/health",{signal:AbortSignal.timeout(900)});
   if(r.status===200) return {process,url,logs:()=>output+"\n"+errors};
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 process.kill("SIGTERM");
 throw Error("Vault CLI failed to report health");
}
async function stop(child){
 if(child.exitCode!==null||child.signalCode!==null)return;
 child.kill("SIGTERM");
 await Promise.race([
  new Promise(resolve=>child.once("exit",resolve)),
  new Promise(resolve=>setTimeout(resolve,1200))
 ]);
 if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");
}
test("real local CLI loads allowed Hercules docs and answers authenticated questions with exact citations",async()=>{
 const s=await openRealCli();
 try {
  const health=await fetch(s.url+"/health");const status=await health.json();
  assert.equal(status.service,"hercules-vault-source-assistant");
  assert.equal(status.public_release_approved,false);
  const request=async(query,token)=>fetch(s.url+"/v1/vault/ask",{
   method:"POST",headers:{"content-type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
   body:JSON.stringify({query})
  });
  const denied=await request("What does model readiness verify?");
  assert.equal(denied.status,401);
  const permitted=await request("What does Hercules model backend readiness verify?",TOKEN);
  assert.equal(permitted.status,200);
  assert.equal(permitted.headers.get("cache-control"),"no-store");
  const evidence=await permitted.json();
  assert.equal(evidence.found,true);
  assert.equal(evidence.response_type,"source_excerpt");
  assert.equal(evidence.sources.length,1);
  assert.match(evidence.sources[0].path,/^docs\/HERCULES-[A-Z0-9-]+\.md$/);
  assert.match(evidence.sources[0].sha256,/^[a-f0-9]{64}$/);
  assert.ok(evidence.sources[0].end_line>=evidence.sources[0].start_line);
  assert.equal(evidence.general_chat_verified,false);
  assert.equal(evidence.command_executed,false);
  const unknown=await request("Who is the president of the kingdom of Neptune in 2101?",TOKEN);
  assert.equal(unknown.status,200);
  const noEvidence=await unknown.json();
  assert.equal(noEvidence.found,false);
  assert.equal(noEvidence.answer,null);
  assert.deepEqual(noEvidence.sources,[]);
  assert.doesNotMatch(s.logs(),new RegExp(TOKEN));
  assert.doesNotMatch(s.logs(),/What does Hercules model backend/);
 } finally {await stop(s.process)}
});
