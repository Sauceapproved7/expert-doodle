/** Separate Gatehouse server: intentionally no write-capable provider integrations. */
import http from "node:http";
import {readFileSync} from "node:fs";
import {createHmac,timingSafeEqual} from "node:crypto";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
import {assessLaunch,sentinelAlerts,revenueRadar,recoveryPlan,simulateCheckout,
 newEvidenceLedger,appendEvidence,verifyEvidenceLedger,timeMachine,validateTarget} from "./core.mjs";

const directory=dirname(fileURLToPath(import.meta.url));
const files={"/":{name:"index.html",type:"text/html; charset=utf-8"},
 "/app.mjs":{name:"app.mjs",type:"text/javascript; charset=utf-8"},
 "/styles.css":{name:"styles.css",type:"text/css; charset=utf-8"}};
const stableServices=["Shopify","Stripe","Render","Supabase","GitHub","DNS","Hercules MCP","Studio","Smallz","Domain Guard"];
const defaultProbes=[
 {name:"Hercules MCP",url:"https://hercules-mcp.onrender.com/health"},
 {name:"Studio",url:"https://sauceapproved-studio.onrender.com/health"},
 {name:"Smallz",url:"https://smallz-hercules.onrender.com/health"},
 {name:"Domain Guard",url:"https://hercules-domain-guard.onrender.com/health"}
];

function safeCompare(a,b){
 const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));
 return x.length===y.length && timingSafeEqual(x,y);
}
function session(token,day){return createHmac("sha256",token).update("gatehouse-session:"+day).digest("hex");}
function dayIndex(now=Date.now()){return Math.floor(now/86400000);}
function cookieOf(req,name){
 const value=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));
 return value?value.slice(name.length+1):"";
}
function send(res,status,value,type="application/json; charset=utf-8"){
 const body=typeof value==="string"?value:JSON.stringify(value);
 res.writeHead(status,{"content-type":type,"cache-control":"no-store",
  "x-content-type-options":"nosniff","x-frame-options":"DENY",
  "referrer-policy":"no-referrer","permissions-policy":"camera=(), microphone=(), geolocation=()",
  "content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
 res.end(body);
}
function parseBody(req){return new Promise((resolve,reject)=>{
 let body="",size=0;
 req.on("data",chunk=>{size+=chunk.length;if(size>8192){reject(new Error("Body too large"));req.destroy();}else body+=chunk;});
 req.on("end",()=>{try{resolve(JSON.parse(body))}catch{reject(new Error("Malformed JSON"))}});
 req.on("error",reject);
});}
async function probeStatus(p,fetcher,timeoutMs=4000){
 const checkedAt=new Date().toISOString();
 try{
  const url=validateTarget(p.url);
  const signal=AbortSignal.timeout(timeoutMs);
  const res=await fetcher(url,{method:"GET",redirect:"manual",signal,headers:{accept:"application/json"}});
  return {name:p.name,checkedAt,status:res.status===200?"reachable":"unreachable",httpStatus:res.status,
    authoritative:false,notice:"Network reachability only; not proof of billing, identity, sales or healthy production."};
 }catch{return {name:p.name,checkedAt,status:"unreachable",authoritative:false,notice:"Read-only probe was unavailable."};}
}
export function createServer(config={}){
 const token=String(config.accessToken??process.env.GATEHOUSE_ACCESS_TOKEN??"");
 const fetcher=config.fetcher??fetch;
 const probeUrls=config.probeUrls??defaultProbes;
 const targets=probeUrls.filter(p=>{try{validateTarget(p.url);return true}catch{return false}});
 let ledger=newEvidenceLedger(),snapshots=[];
 let latestSimulation=null;
 const authed=req=>Boolean(token) && [dayIndex(),dayIndex()-1].some(d=>safeCompare(cookieOf(req,"gh_session"),session(token,d)));
 return http.createServer(async(req,res)=>{
  const path=new URL(req.url||"/","http://localhost").pathname;
  const method=req.method||"GET";
  if(method==="GET"&&files[path]){
   const f=files[path];return send(res,200,readFileSync(join(directory,f.name),"utf8"),f.type);
  }
  if(method==="GET"&&path==="/health")
   return send(res,200,{service:"hercules-gatehouse",status:"running",mode:"isolated-read-only",
    credentialsConfigured:Boolean(token),productionAuthorized:false});
  if(method==="POST"&&path==="/api/login"){
   if(!token)return send(res,503,{error:"owner-credential-not-configured"});
   if(req.headers["content-type"]?.split(";")[0]!=="application/json")return send(res,415,{error:"JSON required"});
   let data;try{data=await parseBody(req)}catch{return send(res,400,{error:"Invalid request"})}
   if(!safeCompare(data.token,token))return send(res,401,{error:"Invalid credentials"});
   const cookie="gh_session="+session(token,dayIndex())+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=172800";
   res.setHeader("Set-Cookie",cookie);
   return send(res,200,{ok:true,mode:"isolated-read-only"});
  }
  if(method==="POST"&&path==="/api/logout"){
   res.setHeader("Set-Cookie","gh_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
   return send(res,200,{ok:true});
  }
  const route=["/api/dashboard","/api/simulate","/api/timeline","/api/ledger","/api/session"];
  if(route.includes(path)){
   if(!token)return send(res,503,{error:"owner-credential-not-configured"});
   if(!authed(req))return send(res,401,{error:"owner-session-required"});
   if(method==="GET"&&path==="/api/session")return send(res,200,{ok:true,mode:"isolated-read-only"});
   if(method==="POST"&&path==="/api/simulate"){
    if(req.headers["content-type"]?.split(";")[0]!=="application/json")return send(res,415,{error:"JSON required"});
    const origin=req.headers.origin;
    if(origin && new URL(origin).host!==req.headers.host)return send(res,403,{error:"Origin rejected"});
    let data;try{data=await parseBody(req)}catch{return send(res,400,{error:"Invalid input"})}
    try{latestSimulation=simulateCheckout(data);return send(res,200,latestSimulation)}
    catch{return send(res,400,{error:"Unsupported synthetic scenario"})}
   }
   if(method==="GET"&&path==="/api/ledger")
    return send(res,200,{chain:verifyEvidenceLedger(ledger),entries:ledger.slice(-50),storage:"in-memory; ephemeral on service restart"});
   if(method==="GET"&&path==="/api/timeline")
    return send(res,200,{...timeMachine(snapshots),snapshots:snapshots.slice(-15)});
   if(method==="GET"&&path==="/api/dashboard"){
    const observed=await Promise.all(targets.map(p=>probeStatus(p,fetcher)));
    const observedMap=new Map(observed.map(s=>[s.name,s]));
    const signals=stableServices.map(name=>observedMap.get(name)||{name,status:"unknown",authoritative:false});
    const now=new Date().toISOString();
    const alerts=sentinelAlerts(signals,now);
    const launch=assessLaunch({},now);
    const recovery=recoveryPlan(alerts);
    const snapshot={at:now,signals:signals.map(s=>({name:s.name,status:s.status}))};
    snapshots.push(snapshot);if(snapshots.length>100)snapshots.shift();
    if(ledger.length<5000)for(const signal of observed){
      ledger=appendEvidence(ledger,{kind:"connectivity",service:signal.name,state:signal.status,at:now,provenance:"unauthenticated-public-health-probe"});
    }
    return send(res,200,{system:"Hercules Gatehouse",mode:"read-only",
     refreshedAt:now,signals,alerts,launch,revenue:revenueRadar(),recovery,
     evidence:verifyEvidenceLedger(ledger),evidenceStorage:"ephemeral",
     latestSimulation,compare:timeMachine(snapshots),
     notice:"Reachability is informational. Production launches, orders, payments and payouts remain controlled by existing providers and gates."});
   }
   return send(res,405,{error:"Method not allowed"});
  }
  return send(res,404,{error:"Not found"});
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.PORT||8787);
 createServer().listen(port,"0.0.0.0",()=>process.stdout.write("Gatehouse isolated listener ready on "+port+"\n"));
}
