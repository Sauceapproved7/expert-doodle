import {createServer} from "node:http";
import {routeBaseRequest} from "./router.mjs";
import {routeAuthRequest} from "./auth-router.mjs";
import {createPostgrestAuthStore} from "./auth-store.mjs";
import {routeStorageRequest} from "./storage-router.mjs";
import {createPostgrestStorageStore} from "./storage-store.mjs";
import {createFilesystemBlobStore} from "./storage-core.mjs";

const host=process.env.HERCULES_BASE_HOST||"0.0.0.0";
const port=Number(process.env.HERCULES_BASE_PORT||38800);
const controlToken=process.env.HERCULES_BASE_CONTROL_TOKEN||"";
const jwtSecret=process.env.HERCULES_BASE_JWT_SECRET||"";
const postgrestUrl=process.env.HERCULES_BASE_POSTGREST_URL||"http://postgrest:3000";
const fixtureOnly=process.env.HERCULES_BASE_FIXTURE_ONLY==="true";
const storageRoot=process.env.HERCULES_BASE_STORAGE_ROOT||"/base-storage";

if(!controlToken){
  throw new Error("HERCULES_BASE_CONTROL_TOKEN is required");
}
if(!jwtSecret||Buffer.byteLength(jwtSecret)<32){
  throw new Error("HERCULES_BASE_JWT_SECRET must be at least 32 bytes");
}
const authStore=createPostgrestAuthStore({postgrestUrl,jwtSecret});
const storageStore=createPostgrestStorageStore({postgrestUrl,jwtSecret});
const blobs=createFilesystemBlobStore({root:storageRoot});

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
    const fetchRequest=nodeRequestToFetch(request);
    const pathname=new URL(fetchRequest.url).pathname;
    const routed=pathname.startsWith("/v1/auth/")
      ?await routeAuthRequest(fetchRequest,{store:authStore,jwtSecret,fixtureOnly})
      :pathname.startsWith("/v1/storage/")
        ?await routeStorageRequest(fetchRequest,{store:storageStore,blobs,jwtSecret})
        :await routeBaseRequest(fetchRequest,{controlToken});
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
