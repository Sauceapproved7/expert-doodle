const enc=new TextEncoder();
function b64u(b:Uint8Array){return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function dec(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");s+="=".repeat((4-s.length%4)%4);return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function hash(s:string){return b64u(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))))}
export function constantTime(a:string,b:string){const x=enc.encode(a),y=enc.encode(b);if(x.length!==y.length)return false;let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0}
function canonicalHtu(raw:string){const u=new URL(raw);u.search="";u.hash="";return u.toString()}
export async function jwkThumbprint(jwk:JsonWebKey){if(jwk.kty!=="EC"||jwk.crv!=="P-256"||!jwk.x||!jwk.y)throw new Error("DPOP_KEY_UNSUPPORTED");return hash(JSON.stringify({crv:jwk.crv,kty:jwk.kty,x:jwk.x,y:jwk.y}))}
export async function verifyDpopRequest(req:Request,rawToken:string,expectedJkt:string,replay:(key:string,ttl:number)=>Promise<boolean>){
 const jwt=req.headers.get("DPoP")||"";const p=jwt.split(".");if(p.length!==3)throw new Error("DPOP_PROOF_REQUIRED");
 const h=JSON.parse(new TextDecoder().decode(dec(p[0]))),c=JSON.parse(new TextDecoder().decode(dec(p[1])));
 if(h.typ!=="dpop+jwt"||h.alg!=="ES256"||!h.jwk)throw new Error("DPOP_HEADER_INVALID");
 const key=await crypto.subtle.importKey("jwk",h.jwk,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
 if(!await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,dec(p[2]),enc.encode(p[0]+"."+p[1])))throw new Error("DPOP_SIGNATURE_INVALID");
 if(c.htm!==req.method.toUpperCase()||canonicalHtu(c.htu)!==canonicalHtu(req.url))throw new Error("DPOP_REQUEST_MISMATCH");
 const now=Math.floor(Date.now()/1000);if(!Number.isInteger(c.iat)||Math.abs(now-c.iat)>300||typeof c.jti!=="string")throw new Error("DPOP_PROOF_STALE");
 const jkt=await jwkThumbprint(h.jwk);if(!constantTime(jkt,expectedJkt))throw new Error("DPOP_KEY_BINDING_INVALID");
 if(!constantTime(String(c.ath||""),await hash(rawToken)))throw new Error("DPOP_TOKEN_HASH_INVALID");
 if(!await replay("dpop:replay:"+jkt+":"+c.jti,300))throw new Error("DPOP_REPLAY");
 return true;
}
