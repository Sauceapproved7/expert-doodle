import http from "node:http";

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});

export function createApiHandler({commerceEnabled=false}={}){
  return async function handle(req){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname==="/health")return json({ok:true,service:"hercules-shopify-api",commerceEnabled:Boolean(commerceEnabled)});
    if(req.method==="POST"&&url.pathname==="/admin/graphql"){
      if(!commerceEnabled)return json({error:"commerce_disabled"},503);
      return json({error:"not_configured"},503);
    }
    return json({error:"not_found"},404);
  };
}

export function startApi({port=Number(process.env.PORT||8080),commerceEnabled=process.env.COMMERCE_ENABLED==="true"}={}){
  const handler=createApiHandler({commerceEnabled});
  const server=http.createServer(async(req,res)=>{
    const chunks=[]; for await(const chunk of req)chunks.push(chunk);
    const request=new Request(`http://localhost:${port}${req.url||"/"}`,{method:req.method,headers:req.headers,body:["GET","HEAD"].includes(req.method||"GET")?undefined:Buffer.concat(chunks)});
    const response=await handler(request);
    res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  server.listen(port);
  return server;
}

if(import.meta.url===new URL("file://"+process.argv[1]).href)startApi();
