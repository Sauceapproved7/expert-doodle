import {createServer} from "node:http";

const port=Number(process.env.HERCULES_PERF_FIXTURE_PORT||3000);
const paths=new Set(["/api/health","/api/v10/health","/api/v10/readiness"]);

const server=createServer((request,response)=>{
  const path=new URL(request.url||"/","http://127.0.0.1").pathname;
  if(request.method!=="GET"||!paths.has(path)){
    response.writeHead(404,{"content-type":"application/json","cache-control":"no-store"});
    response.end(JSON.stringify({ok:false,error:"fixture_route_not_found"}));
    return;
  }
  const body=JSON.stringify({ok:true,fixture:true,path,time:new Date().toISOString()});
  response.writeHead(200,{"content-type":"application/json","content-length":Buffer.byteLength(body),"cache-control":"no-store"});
  response.end(body);
});

server.listen(port,"127.0.0.1",()=>console.log(`hercules_performance_fixture_ready:http://127.0.0.1:${port}`));
