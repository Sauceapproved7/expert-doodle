import {createServer} from "node:https";
import {readFileSync} from "node:fs";
import {createHash,createHmac,timingSafeEqual} from "node:crypto";

export const MAX_BODY_BYTES=1024*1024;
export const ALLOWED_TOPICS=new Set(["orders/paid","app/uninstalled","domains/create","domains/update","domains/destroy"]);
const CANONICAL_SHOP="sauceapproved-2.myshopify.com";

function header(req,name){const v=req.headers[name.toLowerCase()];return Array.isArray(v)?v[0]??"":String(v??"")}
function json(res,status,body){const data=Buffer.from(JSON.stringify(body));res.writeHead(status,{"content-type":"application/json","content-length":String(data.length),"cache-control":"no-store","x-content-type-options":"nosniff"});res.end(data)}

export function verifyShopifyHmac(rawBody,hmacHeader,secret){
  if(!Buffer.isBuffer(rawBody)||!secret||!/^[A-Za-z0-9+/]+={0,2}$/.test(hmacHeader??""))return false;
  let received;
  try{received=Buffer.from(hmacHeader,"base64")}catch{return false}
  const expected=createHmac("sha256",secret).update(rawBody).digest();
  return received.length===expected.length&&timingSafeEqual(received,expected);
}

async function readRawBody(req){
  const chunks=[];let total=0;
  for await(const chunk of req){
    total+=chunk.length;
    if(total>MAX_BODY_BYTES)throw Object.assign(new Error("body_too_large"),{statusCode:413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks,total);
}

async function durableIngest(record,env=process.env){
  const base=String(env.SUPABASE_URL??"").replace(/\/$/,"");
  const anon=String(env.SUPABASE_ANON_KEY??"");
  const token=String(env.SHOPIFY_INGEST_TOKEN??"");
  if(!base||!anon||!token)throw new Error("ingest_not_configured");
  const response=await fetch(`${base}/rest/v1/rpc/hercules_shopify_webhook_ingest_v1`,{
    method:"POST",
    headers:{"content-type":"application/json","apikey":anon,"authorization":`Bearer ${anon}`},
    body:JSON.stringify({p_ingest_token:token,...record}),
    signal:AbortSignal.timeout(5000)
  });
  if(!response.ok)throw new Error(`durable_ingest_failed:${response.status}`);
  const result=await response.json();
  if(result?.accepted!==true&&result?.duplicate!==true)throw new Error("durable_ingest_rejected");
  return result;
}

export async function handleWebhook(req,res,env=process.env){
  if(req.method==="GET"&&(req.url==="/healthz"||req.url==="/readyz"))return json(res,200,{ok:true});
  if(req.method!=="POST"||req.url!=="/webhooks/shopify")return json(res,404,{error:"not_found"});

  let rawBody;
  try{rawBody=await readRawBody(req)}catch(error){return json(res,error?.statusCode??400,{error:error?.message??"invalid_body"})}

  const supplied=header(req,"x-shopify-hmac-sha256");
  const secret=String(env.SHOPIFY_CLIENT_SECRET??"");
  if(!verifyShopifyHmac(rawBody,supplied,secret))return json(res,401,{error:"invalid_hmac"});

  const webhookId=header(req,"x-shopify-webhook-id");
  const eventId=header(req,"x-shopify-event-id")||null;
  const topic=header(req,"x-shopify-topic").toLowerCase();
  const shopDomain=header(req,"x-shopify-shop-domain").toLowerCase();
  const apiVersion=header(req,"x-shopify-api-version")||null;
  const triggeredAt=header(req,"x-shopify-triggered-at")||null;
  if(!webhookId||!topic||!shopDomain)return json(res,400,{error:"missing_delivery_metadata"});
  if(shopDomain!==CANONICAL_SHOP)return json(res,403,{error:"shop_not_allowed"});
  if(!ALLOWED_TOPICS.has(topic)){res.writeHead(204);return res.end()}

  let payload;
  try{payload=JSON.parse(rawBody.toString("utf8"))}catch{return json(res,400,{error:"invalid_json"})}
  const payloadSha256=createHash("sha256").update(rawBody).digest("hex");

  try{
    await durableIngest({
      p_webhook_id:webhookId,
      p_event_id:eventId,
      p_shop_domain:shopDomain,
      p_topic:topic,
      p_api_version:apiVersion,
      p_triggered_at:triggeredAt,
      p_payload_sha256:payloadSha256,
      p_payload_json:payload
    },env);
  }catch{
    return json(res,503,{error:"durable_ingest_unavailable"});
  }
  res.writeHead(204);
  res.end();
}

if(import.meta.url===`file://${process.argv[1]}`){
  const cert=readFileSync(process.env.TLS_CERT_PATH??"/var/run/tls/tls.crt");
  const key=readFileSync(process.env.TLS_KEY_PATH??"/var/run/tls/tls.key");
  const server=createServer({cert,key},(req,res)=>{handleWebhook(req,res).catch(()=>json(res,500,{error:"internal_error"}))});
  server.headersTimeout=10000;
  server.requestTimeout=10000;
  server.keepAliveTimeout=5000;
  server.listen(Number(process.env.PORT??8443),"0.0.0.0");
}
