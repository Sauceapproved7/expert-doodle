import {createServer} from "node:http";
import {routeBaseRequest} from "./router.mjs";

const host=process.env.HERCULES_BASE_HOST||"0.0.0.0";
const port=Number(process.env.HERCULES_BASE_PORT||38800);
const controlToken=process.env.HERCULES_BASE_CONTROL_TOKEN||"";

if(!controlToken){
  throw new Error("HERCULES_BASE_CONTROL_TOKEN is required");
}

function nodeRequestToFetch(request){
  const origin="http://hercules-base.local";
  const target=new URL(request.url||"/",origin);
  const headers=new Headers();
  for(const [name,value] of Object.entries(request.headers)){
    if(Array.isArray(value)){
      for(const item of value)headers.append(name,item);
    }else if(value!==undefined){
      headers.set(name,String(value));
    }
  }

  const method=request.method||"GET";
  const body=(method==="GET"||method==="HEAD")
    ?undefined
    :new ReadableStream({
      start(controller){
        request.on("data",(chunk)=>controller.enqueue(chunk));
        request.on("end",()=>controller.close());
        request.on("error",(error)=>controller.error(error));
      },
    });

  return new Request(target,{
    method,
    headers,
    body,
    duplex:body?"half":undefined,
  });
}

createServer(async(request,response)=>{
  try{
    const routed=await routeBaseRequest(nodeRequestToFetch(request),{controlToken});
    response.statusCode=routed.status;
    for(const [name,value] of routed.headers){
      response.setHeader(name,value);
    }
    response.end(Buffer.from(await routed.arrayBuffer()));
  }catch{
    response.statusCode=500;
    response.setHeader("content-type","application/json");
    response.setHeader("cache-control","no-store");
    response.end(JSON.stringify({ok:false,error:"internal_error"}));
  }
}).listen(port,host,()=>{
  console.log("hercules_base_ready:"+port);
});
