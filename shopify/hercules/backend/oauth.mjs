import crypto from "node:crypto";

export const REQUIRED_SCOPES=Object.freeze(["read_inventory","read_locations","read_orders","read_products"]);

function required(value,name){const v=String(value??"").trim();if(!v)throw new Error(name+"_required");return v;}
function shopDomain(value){const v=required(value,"shop").toLowerCase();if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(v))throw new Error("invalid_shop_domain");return v;}
function safeEqual(a,b){const left=Buffer.from(String(a),"utf8"),right=Buffer.from(String(b),"utf8");return left.length===right.length&&crypto.timingSafeEqual(left,right);}

export function buildAuthorizationUrl({shop,clientId,redirectUri,state,scopes=REQUIRED_SCOPES}={}){
 const host=shopDomain(shop),id=required(clientId,"client_id"),redirect=required(redirectUri,"redirect_uri"),nonce=required(state,"state");
 const scopeList=[...new Set(scopes.map(x=>required(x,"scope")))].sort();
 const params=new URLSearchParams({client_id:id,scope:scopeList.join(","),redirect_uri:redirect,state:nonce});
 return `https://${host}/admin/oauth/authorize?${params}`;
}

export function verifyOAuthCallback({query,expectedState,secret}={}){
 if(!query||typeof query!=="object")throw new Error("invalid_oauth_callback");
 const received=required(query.hmac,"hmac"),nonce=required(query.state,"state"),expected=required(expectedState,"expected_state"),key=required(secret,"secret");
 if(!safeEqual(nonce,expected))throw new Error("oauth_state_mismatch");
 const entries=Object.entries(query).filter(([k])=>k!=="hmac"&&k!=="signature").flatMap(([k,v])=>Array.isArray(v)?v.map(x=>[k,String(x)]):[[k,String(v)]]);
 entries.sort(([a],[b])=>a.localeCompare(b));
 const message=entries.map(([k,v])=>`${k}=${v}`).join("&");
 const calculated=crypto.createHmac("sha256",key).update(message).digest("hex");
 if(!safeEqual(calculated,received))throw new Error("invalid_oauth_hmac");
 return {shop:shopDomain(query.shop),code:required(query.code,"code"),state:nonce};
}

export function validateGrantedScopes(scope){
 const granted=new Set(String(scope??"").split(",").map(x=>x.trim()).filter(Boolean));
 for(const needed of REQUIRED_SCOPES)if(!granted.has(needed))throw new Error("missing_required_scope:"+needed);
 return [...REQUIRED_SCOPES];
}

export function buildExpiringOfflineTokenExchange({clientId,clientSecret,code}={}){
 return {client_id:required(clientId,"client_id"),client_secret:required(clientSecret,"client_secret"),code:required(code,"code"),expiring:1};
}
