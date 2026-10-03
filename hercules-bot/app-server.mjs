import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createOperatorController} from "./operator-controller.mjs";
import {createOperatorConsole} from "./operator-v4.mjs";
import {createOperatorSession} from "./operator-v5.mjs";
import {createSimulatedBodyAdapter} from "./body-sim-adapter.mjs";
import {createDeployerAdapter} from "./deployer-adapter.mjs";
import {createSmallzOwnerBridge} from "./owner-session-bridge.mjs";
import {createSmallzRequestAuth} from "./request-auth.mjs";

function json(status,body){return {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"},body};}
function createServerSideDeployRequest(){
 const base=process.env.HERCULES_DEPLOY_URL,token=process.env.HERCULES_DEPLOY_CONTROL_TOKEN;
 if(!base||!token)return async()=>{throw Object.assign(new Error("deployer-not-configured"),{code:"deployer-not-configured"});};
 return async({method,path,body})=>{const response=await fetch(new URL(path,base),{method,headers:{authorization:`Bearer ${token}`,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});if(!response.ok)throw Object.assign(new Error("deployer-request-failed"),{status:response.status});return response.json();};
}
export function createHerculesBotApp({port=Number(process.env.PORT||38801),mcpWorkEndpoint=process.env.HERCULES_MCP_WORK_URL}={}){
 const body=createSimulatedBodyAdapter();
 const ownerBridge=mcpWorkEndpoint?createSmallzOwnerBridge({endpoint:mcpWorkEndpoint}):null;
 const deployer=createDeployerAdapter({request:createServerSideDeployRequest()});
 const controller=createOperatorController({adapters:{body,system:{status:async()=>({ok:true,mode:"software"})},vault:{inspect:async()=>({available:true,mode:"read-only"})},forge:{inspect:async()=>({available:true,mode:"read-only"})},deployer}});
 const console=createOperatorConsole({controller}),session=createOperatorSession({console});
 async function handle(req={}){
  const method=String(req.method??"GET").toUpperCase(),url=String(req.url??"/").split("?")[0];
  if(method==="GET"&&url==="/health")return json(200,{ok:true,service:"smallz",hardware:"disconnected",browserBridge:!!ownerBridge});
  if(method==="GET"&&url==="/api/auth-config"){const authUrl=process.env.SUPABASE_PUBLIC_URL,authKey=process.env.SUPABASE_PUBLISHABLE_KEY;if(!authUrl||!authKey)return json(503,{error:"owner-auth-not-configured"});return json(200,{url:authUrl,key:authKey});}
  if(method==="GET"&&url==="/app")return {status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"},body:await readFile(join(fileURLToPath(new URL(".",import.meta.url)),"index.html"),"utf8")};
  if(method==="GET"&&url==="/api/state")return json(200,{body:await body.status(),pending:session.pending?.()??null,ownerControl:true,controls:["approve","emergency-stop","resume"]});
  if(method==="POST"&&url==="/api/browser"){
   if(!ownerBridge)return json(503,{error:"smallz-browser-bridge-not-configured"});
   const {ownerAuthorization,body:request}=createSmallzRequestAuth({authorization:req.authorization,body:req.body});
   return json(200,await ownerBridge({ownerAuthorization,action:request.action,url:request.url}));
  }
  if(method==="POST"&&url==="/api/command"){const text=req.body?.text;if(typeof text!=="string"||!text.trim())return json(400,{error:"command-required"});return json(200,await session.receive(text));}
  if(method==="POST"&&url==="/api/approve")return json(200,await session.approve());
  if(method==="POST"&&url==="/api/estop")return json(200,await session.emergencyStop());
  if(method==="POST"&&url==="/api/resume")return json(200,await session.resume());
  if(method==="GET"&&url==="/")return json(200,{ok:true,app:"Smallz",message:"Use the authenticated owner console."});
  return json(404,{error:"not-found"});
 }
 async function listen(){
  const server=createServer(async(req,res)=>{try{let requestBody={};if(req.method==="POST"){let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>262144)throw Object.assign(new Error("request-too-large"),{statusCode:413});}requestBody=raw?JSON.parse(raw):{};}const result=await handle({method:req.method,url:req.url,body:requestBody,authorization:req.headers.authorization});res.writeHead(result.status,result.headers);res.end(typeof result.body==="string"?result.body:JSON.stringify(result.body));}catch(error){const status=error?.statusCode===413?413:error?.message==="owner authorization required"?401:400;res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify({error:status===413?"request-too-large":status===401?"owner-authorization-required":"invalid-request"}));}});
  await new Promise(resolve=>server.listen(port,"0.0.0.0",resolve));return {server,url:`http://127.0.0.1:${server.address().port}`};
 }
 return Object.freeze({handle,listen});
}
if(import.meta.url===`file://${process.argv[1]}`)createHerculesBotApp().listen();
