import {createServer} from "node:http";
import {createOperatorController} from "./operator-controller.mjs";
import {createOperatorConsole} from "./operator-v4.mjs";
import {createOperatorSession} from "./operator-v5.mjs";
import {createSimulatedBodyAdapter} from "./body-sim-adapter.mjs";

function json(status,body){return {status,headers:{"content-type":"application/json; charset=utf-8"},body};}
function readBody(req){return req?.body && typeof req.body==="object"?req.body:{};}

export function createHerculesBotApp({port=38801}={}) {
  const body=createSimulatedBodyAdapter();
  const controller=createOperatorController({
    adapters:{
      body,
      system:{status:async()=>({ok:true,mode:"software"})},
      vault:{inspect:async()=>({available:true,mode:"read-only"})},
      forge:{inspect:async()=>({available:true,mode:"read-only"})}
    }
  });
  const console=createOperatorConsole({controller});
  const session=createOperatorSession({console});

  async function handle(req={}) {
    const method=String(req.method??"GET").toUpperCase();
    const url=String(req.url??"/").split("?")[0];

    if(method==="GET" && url==="/health") return json(200,{ok:true,service:"hercules-bot",hardware:"disconnected"});
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
