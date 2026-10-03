import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createOperatorController} from "./operator-controller.mjs";
import {createOperatorConsole} from "./operator-v4.mjs";
import {createOperatorSession} from "./operator-v5.mjs";
import {createSimulatedBodyAdapter} from "./body-sim-adapter.mjs";
import {createBrowserAdapter} from "./browser-adapter.mjs";
import {createDeployerAdapter} from "./deployer-adapter.mjs";
import {createAbyssOrchestrator} from "./abyss-orchestrator.mjs";
import {createAbyssRuntimeBoundary} from "./abyss-runtime-boundary.mjs";

function json(status,body){return {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"},body};}
function safePlan(orchestrator,plan){
  const capability=plan?.command?.mutates===true?"builder-mode":"self-diagnostic";
  return orchestrator.plan({capability,intent:plan?.command?.verb});
}
function responseError(error){
  const status=Number(error?.statusCode);
  return json(status>=400&&status<=599?status:503,{error:status===401?"owner-authorization-required":status===403?"owner-identity-rejected":"security-boundary-unavailable"});
}

function createServerSideBrowserSubmit(){
  const endpoint=process.env.HERCULES_BROWSER_BRIDGE_URL;
  const token=process.env.HERCULES_BROWSER_BRIDGE_TOKEN;
  if(!endpoint||!token)return async()=>{throw new Error("browser-bridge-not-configured")};
  return async request=>{
    const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify(request),signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error("browser-bridge-request-failed");
    return response.json();
  };
}
function createServerSideDeployRequest(){
  const base=process.env.HERCULES_DEPLOY_URL,token=process.env.HERCULES_DEPLOY_CONTROL_TOKEN;
  if(!base||!token)return async()=>{throw new Error("deployer-not-configured")};
  return async({method,path,body})=>{
    const response=await fetch(new URL(path,base),{method,headers:{authorization:`Bearer ${token}`,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error("deployer-request-failed");
    return response.json();
  };
}

export function createHerculesBotApp({port=Number(process.env.PORT||38801),boundary=createAbyssRuntimeBoundary()}={}){
  const body=createSimulatedBodyAdapter();
  const browser=createBrowserAdapter({submit:createServerSideBrowserSubmit()});
  const deployer=createDeployerAdapter({request:createServerSideDeployRequest()});
  const controller=createOperatorController({adapters:{body,system:{status:async()=>({ok:true,mode:"software"})},vault:{inspect:async()=>({available:true,mode:"read-only"})},forge:{inspect:async()=>({available:true,mode:"read-only"})},browser,deployer}});
  const console=createOperatorConsole({controller});
  const session=createOperatorSession({console});

  const orchestratorFor=state=>createAbyssOrchestrator({
    emergencyStopClear:()=>state.emergencyStopClear===true,
    assessTrust:()=>({identityTrusted:state.identityTrusted===true,auditTrusted:state.auditTrusted===true}),
    authorizeMutation:()=>true,
    verifySandboxPlan:()=>false,
    verifyRecoveryArtifact:boundary.verifyRecoveryArtifact
  });
  async function owner(req,action){
    try{return await action(await boundary.authenticateOwner(req.authorization))}catch(error){return responseError(error)}
  }
  async function stateFor(principal){return boundary.readControlState(principal)}
  async function handle(req={}){
    const method=String(req.method??"GET").toUpperCase(),url=String(req.url??"/").split("?")[0];
    if(method==="GET"&&url==="/health")return json(200,{ok:true,service:"smallz",securityBoundary:"owner-auth-and-external-estop",hardware:"disconnected"});
    if(method==="GET"&&url==="/api/auth-config"){
      const authUrl=process.env.SUPABASE_PUBLIC_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
      if(!authUrl||!key)return json(503,{error:"owner-auth-not-configured"});
      return json(200,{url:authUrl,key});
    }
    if(method==="GET"&&url==="/app")return {status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"},body:await readFile(join(fileURLToPath(new URL(".",import.meta.url)),"index.html"),"utf8")};
    if(method==="GET"&&url==="/")return json(200,{ok:true,app:"Smallz",message:"Use the authenticated owner console."});

    if(method==="GET"&&url==="/api/state")return owner(req,async principal=>{
      const external=await stateFor(principal);
      return json(200,{body:await body.status(),pending:session.pending?.()??null,externalControl:external});
    });
    if(method==="POST"&&url==="/api/command")return owner(req,async principal=>{
      const text=req.body?.text;
      if(typeof text!=="string"||!text.trim())return json(400,{error:"command-required"});
      const plan=await console.plan(text);
      if(plan.status!=="planned")return json(200,plan);
      let state;
      try{state=await stateFor(principal)}catch(error){
        if(plan.command.mutates===true)throw error;
        return json(200,await session.receive(text));
      }
      const decision=safePlan(orchestratorFor(state),plan);
      if(plan.command.mutates===true&&decision.mode!=="policy-controlled")return json(403,{status:"denied",reason:decision.reason??"external-control-blocked"});
      return json(200,await session.receive(text));
    });
    if(method==="POST"&&url==="/api/approve")return owner(req,async principal=>{
      const pending=session.pending?.();
      if(!pending)return json(200,{status:"no-pending-command"});
      const state=await stateFor(principal);
      const plan=await console.plan(pending.input);
      const decision=safePlan(orchestratorFor(state),plan);
      if(decision.mode!=="policy-controlled")return json(403,{status:"denied",reason:decision.reason??"external-control-blocked"});
      return json(200,await session.approve());
    });
    if(method==="POST"&&url==="/api/estop")return owner(req,async principal=>{
      await session.emergencyStop();
      try{const state=await boundary.setExternalStop(principal,"stop");return json(200,{status:"stopped",externalControl:state});}
      catch{return json(503,{status:"stopped-locally",externalControl:"unavailable; mutations remain denied"});}
    });
    if(method==="POST"&&url==="/api/resume")return owner(req,async principal=>{
      const state=await boundary.setExternalStop(principal,"resume");
      if(state.emergencyStopClear!==true||state.identityTrusted!==true||state.auditTrusted!==true)return json(403,{status:"denied",reason:"trusted-external-control-required"});
      return json(200,await session.resume());
    });
    if(method==="POST"&&url==="/api/recovery/verify")return owner(req,async principal=>{
      const state=await stateFor(principal);
      if(state.identityTrusted!==true||state.auditTrusted!==true)return json(403,{eligible:false,reason:"trusted-external-control-required"});
      if(!boundary.verifyRecoveryArtifact(req.body?.artifact))return json(403,{eligible:false,reason:"verified-signed-known-good-artifact-required"});
      return json(200,{eligible:true,executionAuthority:false,artifactDigest:req.body.artifact.digest.toLowerCase()});
    });
    return json(404,{error:"not-found"});
  }

  async function listen(){
    const server=createServer(async(req,res)=>{
      try{
        let body={};
        if(req.method==="POST"){
          let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>262144)throw Object.assign(new Error("request-too-large"),{statusCode:413});}
          body=raw?JSON.parse(raw):{};
        }
        const result=await handle({method:req.method,url:req.url,body,authorization:req.headers.authorization});
        res.writeHead(result.status,result.headers);res.end(typeof result.body==="string"?result.body:JSON.stringify(result.body));
      }catch(error){
        const status=error?.statusCode===413?413:400;
        res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
        res.end(JSON.stringify({error:status===413?"request-too-large":"invalid-request"}));
      }
    });
    await new Promise(resolve=>server.listen(port,"0.0.0.0",resolve));
    return {server,url:`http://127.0.0.1:${server.address().port}`};
  }
  return Object.freeze({handle,listen});
}
if(import.meta.url===`file://${process.argv[1]}`)createHerculesBotApp().listen();
