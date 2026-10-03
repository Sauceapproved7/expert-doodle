import {createServer} from "node:https";
import {readFileSync} from "node:fs";
import {acceptWebhook} from "./webhook-ingress.mjs";

export const MAX_BODY_BYTES=1024*1024;

async function readRawBody(req){
  const chunks=[];let total=0;
  for await(const chunk of req){
    total+=chunk.length;
    if(total>MAX_BODY_BYTES)throw Object.assign(new Error("body_too_large"),{statusCode:413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks,total);
}

function headersFromRequest(req){
  return new Headers(Object.entries(req.headers).flatMap(([key,value])=>
    Array.isArray(value)?value.map(v=>[key,v]):[[key,String(value??"")]]
  ));
}

async function durableAdmission(envelope,env=process.env){
  const url=String(env.SUPABASE_URL??"").replace(/\/$/,"");
  const anon=String(env.SUPABASE_ANON_KEY??"");
  const token=String(env.SHOPIFY_INGEST_TOKEN??"");
  if(!url||!anon||!token)throw new Error("durable_admission_not_configured");
  const response=await fetch(`${url}/rest/v1/rpc/hercules_shopify_webhook_ingest_v1`,{
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

function send(res,status,code=null){
  if(status===204){res.writeHead(204);res.end();return}
  const body=Buffer.from(JSON.stringify(code?{error:code}:{ok:true}));
  res.writeHead(status,{"content-type":"application/json","content-length":String(body.length),"cache-control":"no-store","x-content-type-options":"nosniff"});
  res.end(body);
}

export async function handleRequest(req,res,env=process.env){
  if(req.method==="GET"&&(req.url==="/healthz"||req.url==="/readyz"))return send(res,200);
  if(req.method!=="POST"||req.url!=="/webhooks/shopify")return send(res,404,"not_found");
  let rawBody;
  try{rawBody=await readRawBody(req)}catch(error){return send(res,error?.statusCode??400,error?.message??"invalid_body")}
  const result=await acceptWebhook({
    rawBody,
    headers:headersFromRequest(req),
    secret:String(env.SHOPIFY_CLIENT_SECRET??""),
    admit:(envelope)=>durableAdmission(envelope,env)
  });
  return send(res,result.status,result.code);
}

if(import.meta.url===`file://${process.argv[1]}`){
  const cert=readFileSync(process.env.TLS_CERT_PATH??"/var/run/shopify-tls/tls.crt");
  const key=readFileSync(process.env.TLS_KEY_PATH??"/var/run/shopify-tls/tls.key");
  const server=createServer({cert,key},(req,res)=>{handleRequest(req,res).catch(()=>send(res,500,"internal_error"))});
  server.headersTimeout=10000;
  server.requestTimeout=10000;
  server.keepAliveTimeout=5000;
  server.listen(Number(process.env.PORT??8443),"0.0.0.0");
}
