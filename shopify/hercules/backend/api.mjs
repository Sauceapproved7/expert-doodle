import https from "node:https";
import {readFileSync} from "node:fs";
import {acceptWebhook} from "./webhook-ingress.mjs";

export const MAX_BODY_BYTES=1024*1024;

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});

async function durableAdmission(envelope,env=process.env){
  const base=String(env.SUPABASE_URL??"").replace(/\/$/,"");
  const anon=String(env.SUPABASE_ANON_KEY??"");
  const token=String(env.SHOPIFY_INGEST_TOKEN??"");
  if(!base||!anon||!token)throw new Error("durable_admission_not_configured");
  const response=await fetch(`${base}/rest/v1/rpc/hercules_shopify_webhook_ingest_v1`,{
    method:"POST",
    headers:{"content-type":"application/json","apikey":anon,"authorization":`Bearer ${anon}`},
    body:JSON.stringify({
      p_ingest_token:token,
      p_webhook_id:envelope.webhookId,
      p_event_id:envelope.eventId||null,
      p_shop_domain:envelope.shopDomain,
      p_topic:envelope.topic,
      p_api_version:envelope.apiVersion,
      p_triggered_at:envelope.triggeredAt||null,
      p_payload_sha256:envelope.payloadSha256,
      p_payload_json:envelope.payload
    }),
    signal:AbortSignal.timeout(5000)
  });
  if(!response.ok)throw new Error(`durable_admission_failed:${response.status}`);
  return response.json();
}

export function createApiHandler({
  commerceEnabled=false,
  webhookSecret="",
  admit=null
}={}){
  return async function handle(req){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname==="/health")return json({ok:true,service:"hercules-shopify-api",commerceEnabled:Boolean(commerceEnabled)});
    if(req.method==="GET"&&(url.pathname==="/healthz"||url.pathname==="/readyz"))return json({ok:true});
    if(req.method==="POST"&&url.pathname==="/webhooks/shopify"){
      const rawBody=Buffer.from(await req.arrayBuffer());
      if(rawBody.length>MAX_BODY_BYTES)return json({error:"body_too_large"},413);
      const result=await acceptWebhook({rawBody,headers:req.headers,secret:webhookSecret,admit});
      if(result.status===204)return new Response(null,{status:204});
      return json({error:result.code||"webhook_rejected"},result.status);
    }
    if(req.method==="POST"&&url.pathname==="/admin/graphql"){
      if(!commerceEnabled)return json({error:"commerce_disabled"},503);
      return json({error:"not_configured"},503);
    }
    return json({error:"not_found"},404);
  };
}

async function readBoundedRaw(req){
  const chunks=[];let total=0;
  for await(const chunk of req){
    total+=chunk.length;
    if(total>MAX_BODY_BYTES)throw Object.assign(new Error("body_too_large"),{statusCode:413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks,total);
}

export function startApi({
  port=Number(process.env.PORT||8443),
  commerceEnabled=process.env.COMMERCE_ENABLED==="true",
  webhookSecret=process.env.SHOPIFY_CLIENT_SECRET||"",
  admit=(envelope)=>durableAdmission(envelope,process.env),
  certPath=process.env.TLS_CERT_PATH||"/var/run/shopify-tls/tls.crt",
  keyPath=process.env.TLS_KEY_PATH||"/var/run/shopify-tls/tls.key"
}={}){
  const handler=createApiHandler({commerceEnabled,webhookSecret,admit});
  const server=https.createServer({cert:readFileSync(certPath),key:readFileSync(keyPath)},async(req,res)=>{
    try{
      const raw=["GET","HEAD"].includes(req.method||"GET")?undefined:await readBoundedRaw(req);
      const request=new Request(`https://localhost:${port}${req.url||"/"}`,{method:req.method,headers:req.headers,body:raw});
      const response=await handler(request);
      res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){
      const status=Number(error?.statusCode)||500;
      const response=json({error:status===413?"body_too_large":"internal_error"},status);
      res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
    }
  });
  server.headersTimeout=10000;
  server.requestTimeout=10000;
  server.keepAliveTimeout=5000;
  server.listen(port);
  return server;
}

if(import.meta.url===new URL("file://"+process.argv[1]).href)startApi();
