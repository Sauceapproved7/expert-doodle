import crypto from "node:crypto";

const transitions={
  draft:new Set(["scheduled","cancelled"]),
  scheduled:new Set(["prelive","cancelled"]),
  prelive:new Set(["live","cancelled"]),
  live:new Set(["paused","ended"]),
  paused:new Set(["live","ended"]),
  ended:new Set(["archived"]),
  cancelled:new Set(["archived"]),
  archived:new Set()
};

function assertShop(shopDomain){
  const shop=String(shopDomain||"").trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))throw new Error("invalid_shop_domain");
  return shop;
}
function clone(value){return structuredClone(value);}
function b64u(value){return Buffer.from(value).toString("base64url");}
function sign(input,secret){return crypto.createHmac("sha256",secret).update(input).digest("base64url");}

export function createLiveSession({id,shopDomain,title}={}){
  if(!String(id||"").trim()||!String(title||"").trim())throw new Error("live_session_fields_required");
  return {id:String(id),shopDomain:assertShop(shopDomain),title:String(title).trim(),state:"draft",version:1,commerceEnabled:false,pin:null};
}

export function transitionLiveSession(session,{from,to}={}){
  if(!session||session.state!==from)throw new Error("live_state_conflict");
  if(!transitions[from]?.has(to))throw new Error("invalid_live_transition");
  return {...clone(session),state:to,version:Number(session.version)+1,commerceEnabled:false};
}

export function pinProduct(session,{variantGid,expectedVersion,durationSeconds=300}={}){
  if(Number(session?.version)!==Number(expectedVersion))throw new Error("version_conflict");
  if(!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(String(variantGid||"")))throw new Error("invalid_shopify_variant_gid");
  const duration=Number(durationSeconds);
  if(!Number.isInteger(duration)||duration<1||duration>3600)throw new Error("invalid_pin_duration");
  return {...clone(session),version:Number(session.version)+1,commerceEnabled:false,pin:{variantGid:String(variantGid),durationSeconds:duration}};
}

export async function issueRealtimeTicket({eventId,audience,scopes=[],expiresInSeconds=300,secret,now=Math.floor(Date.now()/1000)}={}){
  if(!secret||Buffer.byteLength(secret)<16)throw new Error("live_ticket_secret_too_short");
  const ttl=Number(expiresInSeconds);
  if(!Number.isInteger(ttl)||ttl<1||ttl>900)throw new Error("invalid_live_ticket_ttl");
  const claims={eventId:String(eventId||""),audience:String(audience||""),scopes:[...new Set(scopes.map(String))].sort(),iat:Number(now),exp:Number(now)+ttl};
  if(!claims.eventId||!claims.audience)throw new Error("live_ticket_claims_required");
  const payload=b64u(JSON.stringify(claims));
  return payload+"."+sign(payload,secret);
}

export async function verifyRealtimeTicket(ticket,{secret,eventId,requiredScope,now=Math.floor(Date.now()/1000)}={}){
  const [payload,signature,...extra]=String(ticket||"").split(".");
  if(!payload||!signature||extra.length)throw new Error("invalid_live_ticket");
  const expected=sign(payload,secret||"");
  const a=Buffer.from(signature),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error("invalid_live_ticket");
  let claims; try{claims=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));}catch{throw new Error("invalid_live_ticket");}
  if(claims.eventId!==eventId)throw new Error("live_ticket_event_mismatch");
  if(Number(now)>=Number(claims.exp))throw new Error("expired_live_ticket");
  if(requiredScope&&!Array.isArray(claims.scopes)||requiredScope&&!claims.scopes.includes(requiredScope))throw new Error("live_ticket_scope_denied");
  return claims;
}
