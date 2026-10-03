import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createOperatorController} from "./operator-controller.mjs";
import {createOperatorConsole} from "./operator-v4.mjs";
import {createOperatorSession} from "./operator-v5.mjs";
import {createSimulatedBodyAdapter} from "./body-sim-adapter.mjs";
import {createBrowserAdapter} from "./browser-adapter.mjs";\nimport {createDeployerAdapter} from "./deployer-adapter.mjs";

function json(status,body){return {status,headers:{"content-type":"application/json; charset=utf-8"},body};}
function readBody(req){return req?.body && typeof req.body==="object"?req.body:{};}

function createServerSideBrowserSubmit(){\n  const endpoint=process.env.HERCULES_BROWSER_BRIDGE_URL;\n  const token=process.env.HERCULES_BROWSER_BRIDGE_TOKEN;\n  if(!endpoint || !token) return async()=>{ throw Object.assign(new Error("browser-bridge-not-configured"),{code:"browser-bridge-not-configured"}); };\n  return async request=>{\n    const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","authorization:`Bearer ${token}`},body:JSON.stringify(request),signal:AbortSignal.timeout(120000)});\n    if(!response.ok) throw Object.assign(new Error("browser-bridge-request-failed"),{code:"browser-bridge-request-failed",status:response.status});\n    return response.json();\n  };\n}\n\nfunction createServerSideDeployRequest(){\n  const base=process.env.HERCULES_DEPLOY_URL;\n  const token=process.env.HERCULES_DEPLOY_CONTROL_TOKEN;\n  if(!base || !token) return async()=>{ throw Object.assign(new Error("deployer-not-configured"),{code:"deployer-not-configured"}); };\n  return async({method,path,body})=>{\n    const url=new URL(path,base);\n    const response=await fetch(url,{method,headers:{"authorization":`Bearer ${token}`,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});\n    if(!response.ok) throw Object.assign(new Error("deployer-request-failed"),{code:"deployer-request-failed",status:response.status});\n    return response.json();\n  };\n}\n\nexport function createHerculesBotApp({port=38801}={}) {
  const body=createSimulatedBodyAdapter();\n  const browser=createBrowserAdapter({submit:createServerSideBrowserSubmit()});\n  const deployer=createDeployerAdapter({request:createServerSideDeployRequest()});
  const controller=createOperatorController({
    adapters:{
      body,
      system:{status:async()=>({ok:true,mode:"software"})},
      vault:{inspect:async()=>({available:true,mode:"read-only"})},
      forge:{inspect:async()=>({available:true,mode:"read-only"})},\n      browser,\n      deployer
    }
  });
  const console=createOperatorConsole({controller});
  const session=createOperatorSession({console});

  async function handle(req={}) {
    const method=String(req.method??"GET").toUpperCase();
    const url=String(req.url??"/").split("?")[0];

    if(method==="GET" && url==="/health") return json(200,{ok:true,service:"hercules-bot",hardware:"disconnected"});
    if(method==="GET" && url==="/app") return {status:200,headers:{"content-type":"text/html; charset=utf-8"},body:await readFile(join(fileURLToPath(new URL(".",import.meta.url)),"index.html"),"utf8")};
    if(method==="GET" && url==="/api/state") {
      return json(200,{
        body:await body.status(),
        pending:session.pending?.() ?? null,
        ownerControl:true,
        controls:["approve","emergency-stop","resume"]
      });
    }
    if(method==="POST" && url==="/api/command") {
      const text=req.body?.text;
      if(typeof text!=="string" || !text.trim()) return json(400,{error:"command-required"});
      return json(200,await session.receive(text));
    }
    if(method==="POST" && url==="/api/approve") return json(200,await session.approve());
    if(method==="POST" && url==="/api/estop") return json(200,await session.emergencyStop());
    if(method==="POST" && url==="/api/resume") return json(200,await session.resume());
    if(method==="GET" && url==="/") return json(200,{ok:true,app:"Hercules Bot",message:"Use the owner console to control the software bot."});
    return json(404,{error:"not-found"});
  }

  async function listen() {
    const server=createServer(async(req,res)=>{
      let body={};
      try {
        if(req.method==="POST"){
          let raw=""; for await(const chunk of req) raw+=chunk;
          if(raw.length>262144) throw Object.assign(new Error("request-too-large"),{statusCode:413});
          body=raw?JSON.parse(raw):{};
        }
        const result=await handle({method:req.method,url:req.url,body});
        res.writeHead(result.status,result.headers);
        res.end(JSON.stringify(result.body));
      } catch(error) {
        const status=error?.statusCode===413?413:400;
        res.writeHead(status,{"content-type":"application/json; charset=utf-8"});
        res.end(JSON.stringify({error:status===413?"request-too-large":"invalid-request"}));
      }
    });
    await new Promise(resolve=>server.listen(port,resolve));
    return {server,url:`http://127.0.0.1:${server.address().port}`};
  }

  return Object.freeze({handle,listen});
}
