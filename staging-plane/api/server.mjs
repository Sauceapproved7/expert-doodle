import {createServer} from "node:http";

const port=Number(process.env.PORT||8080);
const postgrest=process.env.POSTGREST_URL||"http://postgrest:3000";
const paths=new Set(["/api/health","/api/v10/health","/api/v10/readiness"]);

createServer(async(request,response)=>{
  const path=new URL(request.url||"/","http://staging.local").pathname;
  if(request.method!=="GET"||!paths.has(path)){
    response.writeHead(404,{"content-type":"application/json","cache-control":"no-store"});
    response.end(JSON.stringify({ok:false,error:"staging_route_not_found"}));
    return;
  }
  let database=false;
  try{
    const check=await fetch(`${postgrest}/health?select=ok&limit=1`,{signal:AbortSignal.timeout(2000)});
    const data=await check.json();
    database=check.ok&&Array.isArray(data)&&data[0]?.ok===true;
  }catch{}
  const ready=database;
  const body=JSON.stringify({ok:ready,environment:"staging",fixture:true,database,customerData:false,time:new Date().toISOString()});
  response.writeHead(ready?200:503,{"content-type":"application/json","content-length":Buffer.byteLength(body),"cache-control":"no-store","x-hercules-environment":"staging","x-content-type-options":"nosniff"});
  response.end(body);
}).listen(port,"0.0.0.0",()=>console.log(`hercules_staging_api_ready:${port}`));
