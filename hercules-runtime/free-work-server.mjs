import {createServer} from "node:http";
import {Readable} from "node:stream";
import {readFile} from "node:fs/promises";
import {createWorkEngine,createOllamaInfer,routeWorkRequest} from "./free-work-core.mjs";
import {createFileBackedWorkEngine} from "./free-work-persistence.mjs";

const host=process.env.HERCULES_FREE_WORK_HOST||"127.0.0.1";
if(!["127.0.0.1","localhost","::1"].includes(host))throw new Error("Loopback bind required; remote use requires authenticated Hercules gateway");
const port=Number(process.env.HERCULES_FREE_WORK_PORT||38881);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error("Invalid port");
const token=process.env.HERCULES_FREE_WORK_TOKEN||"";
if(Buffer.byteLength(token,"utf8")<32)throw new Error("HERCULES_FREE_WORK_TOKEN must be at least 32 bytes");
const modelName=process.env.HERCULES_FREE_WORK_MODEL||"";
const infer=modelName?createOllamaInfer({
  baseUrl:process.env.HERCULES_FREE_WORK_MODEL_URL||"http://127.0.0.1:11434",
  model:modelName,
}):null;
const statePath=process.env.HERCULES_FREE_WORK_STATE_PATH||"";
const engine=statePath?createFileBackedWorkEngine({path:statePath,infer}):createWorkEngine({infer});
const assets={
  "/":{type:"text/html; charset=utf-8",body:await readFile(new URL("./free-work-ui.html",import.meta.url),"utf8")},
  "/app.js":{type:"text/javascript; charset=utf-8",body:await readFile(new URL("./free-work-app.js",import.meta.url),"utf8")},
  "/app.css":{type:"text/css; charset=utf-8",body:await readFile(new URL("./free-work-style.css",import.meta.url),"utf8")},
};
const server=createServer(async(req,res)=>{
  try{
    const method=req.method||"GET";
    const headers=new Headers();
    for(const [key,value] of Object.entries(req.headers)){
      if(Array.isArray(value))value.forEach(v=>headers.append(key,v));
      else if(value!==undefined)headers.set(key,value);
    }
    const body=method==="GET"||method==="HEAD"?undefined:Readable.toWeb(req);
    const request=new Request("http://127.0.0.1:"+port+(req.url||"/"),{
      method,headers,body,duplex:body?"half":undefined,
    });
    const response=await routeWorkRequest(request,{engine,token,assets});
    res.statusCode=response.status;
    for(const [key,value] of response.headers)res.setHeader(key,value);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{
    if(!res.headersSent){
      res.writeHead(500,{"content-type":"application/json","cache-control":"no-store"});
      res.end('{"ok":false,"error":"internal_error"}');
    }else res.destroy();
  }
});
server.requestTimeout=35000;
server.headersTimeout=10000;
server.listen(port,host,()=>console.log("Hercules Free Work listening on loopback port "+port));
