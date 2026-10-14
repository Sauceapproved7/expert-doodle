/**
 * Real PostgreSQL + Supabase Vault integration checks.
 * Starts disposable non-networked Docker container; no remote database ever used.
 * Synthetic, disposable tokens only. Never print tokens, Vault values or raw SQL.
 */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";

const DB="gatehouse-vault-ci";
const IMAGE="supabase/postgres:17.6.1.173";
const ORG="ea5fb196-67f9-42fa-b592-49eeb3b84346";
const OWNER="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const OTHER="8388a570-7e32-4d63-9bee-9df0c877bbf9";
const uid=x=>"'"+x+"'::uuid";
const ac=x=>"'shpat_"+"SYNTHETIC_VAULT_ACCESS_"+x+"_012345678901'";
const rf=x=>"'shprt_"+"SYNTHETIC_VAULT_REFRESH_"+x+"_012345678901'";
const svc="SET request.jwt.claim.role = 'service_role';\n";
const ticks=()=>{
 const out=spawnSync("docker",["exec",DB,"pg_isready","-U","supabase_admin","-d","postgres"],{
  encoding:"utf8",timeout:7000});
 return out.status===0;
};
let passed=0;
function command(args,{input="",timeout=240000}={}){
 const r=spawnSync("docker",args,{input,encoding:"utf8",maxBuffer:3*1024*1024,timeout});
 if(r.error||r.status!==0)throw Error("isolated-docker-command-failed");
 return r.stdout.trim();
}
function sql(label,query,{expectError=false}={}){
 const a=spawnSync("docker",["exec","-i",DB,"psql","-X","-U","supabase_admin",
  "-d","postgres","-v","ON_ERROR_STOP=1","-A","-t","-q"],{
  encoding:"utf8",input:query,maxBuffer:3*1024*1024,timeout:60000
 });
 if(a.error)throw Error("isolated-postgres:"+label+":unavailable");
 if(expectError){
  assert.notEqual(a.status,0,label+" must reject");
  passed++;
  return null;
 }
 if(a.status!==0){
  const category=(a.stderr||"").split("\n").find(line=>/ERROR:|FATAL:/.test(line))||"sql-execution-failed";
  const diagnostic=spawnSync("docker",["logs","--tail","24",DB],{
   encoding:"utf8",timeout:9000,maxBuffer:8192
  });
  const last=(diagnostic.stderr||diagnostic.stdout||"").split("\n")
   .filter(line=>/ERROR|FATAL|PANIC|shutting down|exited|terminat|initialization/i.test(line))
   .slice(-4).map(line=>line.slice(0,180)).join(" ; ");
  const scrubbed=(category+" [container] "+last).slice(0,750)
   .replace(/(?:shpat_|shprt_)[A-Za-z0-9._-]+/g,"[REDACTED]")
   .replace(/(?:password|secret)[^:]*:\s*\S+/gi,"[REDACTED_FIELD]");
  throw Error("isolated-postgres:"+label+":"+scrubbed);
 }
 passed++;
 return (a.stdout||"").trim().split("\n").filter(Boolean).at(-1)||"";
}
const j=(label,q)=>JSON.parse(sql(label,svc+q));
const v=(label,q)=>sql(label,q);
const bootstrap=(a,r)=>"SELECT public.gatehouse_offline_bootstrap("+uid(ORG)+","+
 uid(OWNER)+","+ac(a)+","+rf(r)+",clock_timestamp()+interval '45 minutes',"+
 "clock_timestamp()+interval '60 days')::text;";
const commit=(nonce,gen,a,r)=>"SELECT public.gatehouse_offline_commit("+uid(ORG)+
 ","+uid(OWNER)+","+uid(nonce)+","+gen+","+ac(a)+","+rf(r)+
 ",clock_timestamp()+interval '45 minutes',clock_timestamp()+interval '60 days')::text;";
const acquire=()=> "SELECT public.gatehouse_offline_acquire("+uid(ORG)+","+uid(OWNER)+")::text;";
const rel=n=>"SELECT public.gatehouse_offline_release("+uid(ORG)+","+uid(OWNER)+","+uid(n)+")::text;";
async function suite(){
 const started=spawnSync("docker",["run","--name",DB,"--rm","--detach",
  "--network","none","--env","POSTGRES_PASSWORD=ephemeral_ci_only_not_reused",
  IMAGE,"postgres","-c","config_file=/etc/postgresql/postgresql.conf"],{
  encoding:"utf8",timeout:240000,maxBuffer:1024*1024});
 if(started.error||started.status!==0)throw Error("ephemeral-postgres-container-unavailable");
 try{
  let healthy=false;
  // Supabase/Postgres exposes a temporary initdb server which is intentionally
  // shut down before the persistent server starts. Do not mistake it as ready.
  for(let i=0;i<100;i++){
   const out=spawnSync("docker",["logs",DB],{
    encoding:"utf8",timeout:7500,maxBuffer:1024*1024
   });
   const boot=(out.stdout||"")+(out.stderr||"");
   const initDone=/PostgreSQL init process complete/i.test(boot);
   if(initDone&&ticks()){healthy=true;break}
   await new Promise(resolve=>setTimeout(resolve,1600));
  }
  if(!healthy)throw Error("ephemeral-postgres-not-ready");
  const fixture=readFileSync(new URL("./fixtures/isolated-vault-bootstrap.sql",import.meta.url),"utf8");
  sql("create-synthetic-roles-owner-and-real-vault",fixture);
  assert.equal(v("real-supabase-vault-extension-loaded",
    "SELECT count(*) FROM pg_extension WHERE extname = 'supabase_vault';"),"1");
  const original=readFileSync(new URL("./offline-vault-v215.sql",import.meta.url),"utf8");
  sql("execute-unmodified-v215-candidate",original);
  assert.equal(v("isolated-table-exists","SELECT CASE WHEN to_regclass("+
   "'hercules_private.gatehouse_shopify_offline_grants') IS NULL THEN 0 ELSE 1 END;"),"1");
  for(const role of ["anon","authenticated"]){
   assert.equal(v(role+"-table-select-denied","SELECT has_table_privilege('"+role+
     "','hercules_private.gatehouse_shopify_offline_grants','SELECT')::int;"),"0");
   for(const action of ["bootstrap","acquire","commit","release"]){
    const sig={bootstrap:"uuid,uuid,text,text,timestamptz,timestamptz",
     acquire:"uuid,uuid",commit:"uuid,uuid,uuid,bigint,text,text,timestamptz,timestamptz",
     release:"uuid,uuid,uuid"}[action];
    assert.equal(v(role+"-"+action+"-rpc-denied",
     "SELECT has_function_privilege('"+role+"','public.gatehouse_offline_"+
     action+"("+sig+")','EXECUTE')::int;"),"0");
   }
  }
  sql("unauthenticated-rpc-not-executable","SET ROLE authenticated;\n"+
   "SELECT public.gatehouse_offline_acquire("+uid(ORG)+","+uid(OWNER)+");",{
   expectError:true});
  sql("missing-owner-rejected",svc+"SELECT public.gatehouse_offline_acquire("+
   uid(ORG)+","+uid(OTHER)+");",{expectError:true});
  assert.equal(v("service-role-rpc-grant-present",
   "SELECT has_function_privilege('service_role',"+
   "'public.gatehouse_offline_acquire(uuid,uuid)','EXECUTE')::int;"),"1");
  sql("revoke-synthetic-owner-membership",
   "UPDATE public.hercules_memberships SET status='inactive' "+
   "WHERE organization_id="+uid(ORG)+" AND user_id="+uid(OWNER)+";");
  sql("inactive-owner-denied",svc+"SELECT public.gatehouse_offline_acquire("+
   uid(ORG)+","+uid(OWNER)+");",{expectError:true});
  sql("restore-synthetic-owner-membership",
   "UPDATE public.hercules_memberships SET status='active' "+
   "WHERE organization_id="+uid(ORG)+" AND user_id="+uid(OWNER)+";");
  const before=Number(v("count-real-vault-secret-rows","SELECT count(*) FROM vault.secrets;"));
  assert.deepEqual(j("first-owner-bootstrap-creates-atomic-pair",bootstrap("A","A")),
   {stored:true,generation:1});
  assert.equal(Number(v("two-vault-secrets-created","SELECT count(*) FROM vault.secrets;")),before+2);
  assert.equal(j("duplicate-bootstrap-refused",bootstrap("B","B")).stored,false);
  assert.equal(Number(v("duplicate-does-not-store","SELECT count(*) FROM vault.secrets;")),before+2);
  assert.equal(v("vault-ciphertexts-not-plaintext","SELECT count(*) FROM vault.secrets"+
   " WHERE secret::text LIKE 'shpat_%' OR secret::text LIKE 'shprt_%';"),"0");
  // Acquire contention: exactly one of two simultaneous Postgres sessions may
  // obtain a lease. Synchronized shared start is not essential to the invariant.
  const promises=[0,1].map(()=>new Promise((resolve,reject)=>{
   import("node:child_process").then(({spawn})=>{
    const p=spawn("docker",["exec","-i",DB,"psql","-X","-U","supabase_admin",
     "-d","postgres","-v","ON_ERROR_STOP=1","-A","-t","-q"]);
    let output="",stderr="";
    p.stdout.on("data",x=>{output+=x.toString()});
    p.stderr.on("data",x=>{stderr+=x.toString()});
    p.on("error",()=>reject(Error("concurrent-pg-process-unavailable")));
    p.on("close",code=>code===0?resolve(JSON.parse(output.trim().split("\n").at(-1))):
     reject(Error("concurrent-lease-query-failed")));
    p.stdin.end(svc+acquire());
   }).catch(reject);
  }));
  const concurrent=await Promise.all(promises);
  passed++;
  assert.deepEqual(concurrent.map(x=>x.leased).sort(),[false,true],
   "only one real Postgres worker may receive exclusive lease");
  const winner=concurrent.find(x=>x.leased===true);
  assert.equal(winner.organization_id,ORG);
  assert.equal(winner.generation,1);
  assert.equal(winner.shop_domain,"azymhc-x0.myshopify.com");
  assert.ok(winner.refresh_token.startsWith("shprt_"));
  const nonce=winner.lease_nonce;
  const rival=j("lease-contender-denied-while-held",acquire());
  assert.equal(rival.leased,false);
  const stale=j("stale-generation-cas-denied",commit(nonce,0,"B","B"));
  assert.equal(stale.stored,false);
  const forged=j("wrong-nonce-cas-denied",commit("8aa8a570-7e32-4d63-9bee-9df0c877bbf9",1,"B","B"));
  assert.equal(forged.stored,false);
  assert.equal(Number(v("no-vault-secret-leak-on-rejected-cas",
   "SELECT count(*) FROM vault.secrets;")),before+2);
  const rollback=sql("forced-postgres-transaction-rollback",
   svc+"BEGIN;\n"+commit(nonce,1,"B","B")+"\nROLLBACK;\n"+
   "SELECT count(*) FROM vault.secrets;");
  assert.equal(Number(rollback),before+2);
  assert.equal(v("generation-unchanged-after-rollback",
   "SELECT generation FROM hercules_private.gatehouse_shopify_offline_grants;"),"1");
  const applied=j("real-dual-token-vault-cas",commit(nonce,1,"B","B"));
  assert.deepEqual(applied,{stored:true,generation:2});
  assert.equal(Number(v("dual-token-commit-adds-two-vault-secrets",
   "SELECT count(*) FROM vault.secrets;")),before+4);
  assert.equal(j("replayed-generation-rejected",commit(nonce,1,"C","C")).stored,false);
  assert.equal(j("valid-nonce-released",rel(nonce)).released,true);
  assert.equal(j("nonce-replay-not-released",rel(nonce)).released,false);
  const next=j("next-generation-lease-acquired",acquire());
  assert.equal(next.leased,true);
  assert.equal(next.generation,2);
  assert.notEqual(next.lease_nonce,nonce);
  assert.equal(next.refresh_token,"shprt_"+"SYNTHETIC_VAULT_REFRESH_B_012345678901");
  assert.equal(j("old-nonce-cannot-commit",commit(nonce,2,"C","C")).stored,false);
  // Expire the test-only active lease without waiting 90 seconds.
  sql("expire-isolated-worker-lease","UPDATE hercules_private.gatehouse_shopify_offline_grants "+
   "SET lease_expires_at=clock_timestamp()-interval '1 second';");
  assert.equal(j("stale-expired-holder-blocked",commit(next.lease_nonce,2,"C","C")).stored,false);
  const recovered=j("crashed-worker-lease-recovered",acquire());
  assert.equal(recovered.leased,true);
  assert.notEqual(recovered.lease_nonce,next.lease_nonce);
  assert.equal(j("recovered-nonce-release",rel(recovered.lease_nonce)).released,true);
  assert.equal(Number(v("no-orphaned-secret-creations","SELECT count(*) FROM vault.secrets;")),before+4);
  process.stdout.write(JSON.stringify({status:"real-postgres-vault-transaction-proof",
   passedAssertions:passed,concurrentLeaseWinners:1,encryptedTokenPairsPersisted:2,
   rollbackVerified:true,mainOrProductionChanged:false})+"\n");
 }finally{
  try{spawnSync("docker",["rm","-f",DB],{encoding:"utf8",timeout:15000})}catch{}
 }
}
try{await suite()}
catch(e){
 process.stderr.write("isolated-gatehouse-vault-witness-failed:"+
  String(e?.message||"unknown").replace(/(?:shpat_|shprt_)[A-Za-z0-9._-]+/g,"[REDACTED]")+"\n");
 process.exitCode=1;
}
