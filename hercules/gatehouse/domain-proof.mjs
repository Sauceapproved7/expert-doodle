/** SauceApproved Gatehouse signed website-control challenge, not a customer login, commerce, or public scanning API. */
import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {lookup as dnsLookup} from "node:dns/promises";
import https from "node:https";
import {isIP} from "node:net";
import {normalizeIntake} from "./commerce.mjs";

const TTL_MS=15*60*1000;
const ORG=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validSecret(secret){return (Buffer.isBuffer(secret)||typeof secret==="string")&&Buffer.byteLength(secret)>=32}
function assertOrg(id){if(typeof id!=="string"||!ORG.test(id))throw new TypeError("Valid organization scope required")}
function mac(secret,payload){return createHmac("sha256",secret).update(payload).digest("base64url")}
const verifiedHold={customerIdentityVerified:false,paidOrderVerified:false,deliveryAuthorized:false,purchaseEnabled:false};

export function issueDomainChallenge({origin,organizationId,secret,now=Date.now(),nonce=randomBytes(24)}={}){
 if(!validSecret(secret))throw new TypeError("Missing secure challenge key");
 assertOrg(organizationId);
 const target=normalizeIntake({website:origin,authorized:true});
 const hostname=new URL(target.website).hostname;
 if(!Buffer.isBuffer(nonce)||nonce.length!==24)throw new TypeError("Invalid random challenge nonce");
 const issueTime=Number(now);
 if(!Number.isSafeInteger(issueTime)||issueTime<0)throw new TypeError("Invalid clock");
 const n=nonce.toString("hex");
 const claims={version:1,organizationId,hostname,nonce:n,issuedAt:issueTime,expiresAt:issueTime+TTL_MS};
 const encoded=Buffer.from(JSON.stringify(claims)).toString("base64url");
 return {hostname,publicationPath:"/.well-known/sauceapproved-gatehouse/"+n+".txt",
  nonce:n,token:encoded+"."+mac(secret,encoded),
  expiresAt:new Date(claims.expiresAt).toISOString(),
  verified:false,authorizedCustomerRequest:false,customerWebsiteProbed:false,
  deliveryAuthorized:false,notice:"Challenge issuance is only a technical preparation; actual customer identity and consent must be verified separately."};
}
export function validateDomainChallenge({token,secret,organizationId,now=Date.now()}={}){
 if(!validSecret(secret))throw new TypeError("Missing secure challenge key");
 assertOrg(organizationId);
 if(typeof token!=="string"||token.length>1500||!token.includes("."))throw new TypeError("Invalid challenge");
 const [encoded,signature,...rest]=token.split(".");
 if(rest.length||!encoded||!signature||!/^[-_A-Za-z0-9]+$/.test(encoded)||!/^[-_A-Za-z0-9]+$/.test(signature))throw new TypeError("Invalid challenge");
 const expected=Buffer.from(mac(secret,encoded));
 const received=Buffer.from(signature);
 if(received.length!==expected.length||!timingSafeEqual(received,expected))throw new TypeError("Bad challenge signature");
 let c;
 try{c=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8"))}catch{throw new TypeError("Malformed challenge")}
 const time=Number(now);
 if(c?.version!==1||c?.organizationId!==organizationId||!ORG.test(c.organizationId)||
  typeof c.hostname!=="string"||typeof c.nonce!=="string"||!/^[0-9a-f]{48}$/.test(c.nonce)||
  typeof c.issuedAt!=="number"||!Number.isSafeInteger(c.issuedAt)||
  typeof c.expiresAt!=="number"||c.expiresAt-c.issuedAt!==TTL_MS||
  !Number.isSafeInteger(time)||time<c.issuedAt||time>c.expiresAt)
  throw new TypeError("Challenge out of scope or expired");
 const origin="https://"+c.hostname;
 if(new URL(normalizeIntake({website:origin,authorized:true}).website).hostname!==c.hostname)throw new TypeError("Invalid challenge host");
 return {hostname:c.hostname,nonce:c.nonce,publicationPath:"/.well-known/sauceapproved-gatehouse/"+c.nonce+".txt",
  organizationId:c.organizationId,expiresAt:new Date(c.expiresAt).toISOString()};
}
/** Strict IPv4-only policy; blocks internal/link-local/loopback, test, multicast and reserved ranges. */
export function isPublicIPv4(address){
 if(typeof address!=="string"||isIP(address)!==4)return false;
 const a=address.split(".").map(Number);
 if(a.length!==4||a.some(v=>!Number.isInteger(v)||v<0||v>255))return false;
 const [x,y,z]=a;
 if(x===0||x===10||x===127||x>=224||x===255)return false;
 if(x===100&&y>=64&&y<=127)return false;
 if(x===169&&y===254)return false;
 if(x===172&&y>=16&&y<=31)return false;
 if(x===192&&(y===168||(y===0&&z===0)||(y===0&&z===2)||(y===88&&z===99)))return false;
 if(x===198&&((y===18||y===19)||(y===51&&z===100)))return false;
 if(x===203&&y===0&&z===113)return false;
 return true;
}
/** Rejects ambiguous DNS answers entirely, not just the first private one. */
export async function resolvePinnedAddress(hostname,lookup=dnsLookup){
 const answer=await lookup(hostname,{all:true,verbatim:true});
 if(!Array.isArray(answer)||!answer.length||answer.length>16||answer.some(row=>row?.family!==4||!isPublicIPv4(row.address)))
  throw new Error("Unsafe, unresolvable or ambiguous website DNS");
 return answer[0].address;
}
/** https.request pins vetted IP while preserving hostname for TLS cert/SNI; never follows redirects. */
export function pinnedHTTPSGet({hostname,pinnedIPv4,path,timeoutMs=4000}){
 if(!isPublicIPv4(pinnedIPv4)||typeof hostname!=="string"||
  typeof path!=="string"||!/^\/\.well-known\/sauceapproved-gatehouse\/[0-9a-f]{48}\.txt$/.test(path))
  return Promise.reject(new Error("Invalid destination"));
 return new Promise((resolve,reject)=>{
  let size=0,body="";
  const req=https.request({protocol:"https:",hostname,port:443,path,method:"GET",
   servername:hostname,rejectUnauthorized:true,agent:false,timeout:timeoutMs,
   headers:{accept:"text/plain", "user-agent":"Hercules-Gatehouse-Domain-Proof/1.0"},
   lookup:(_hostname,_options,done)=>done(null,pinnedIPv4,4)
  },res=>{
   res.setEncoding("utf8");
   res.on("data",chunk=>{size+=Buffer.byteLength(chunk);if(size>2048){req.destroy(new Error("Challenge response too large"));return}body+=chunk});
   res.on("end",()=>resolve({status:res.statusCode,contentType:String(res.headers["content-type"]||"").split(";")[0].trim().toLowerCase(),body}));
   res.on("error",reject);
  });
  req.on("timeout",()=>req.destroy(new Error("Domain challenge timeout")));
  req.on("error",reject);
  req.end();
 });
}
/** No public route exposes this operation. The future account API MUST verify owner auth and site consent. */
export async function verifyDomainChallenge({token,secret,organizationId,now=Date.now(),lookup=dnsLookup,request=pinnedHTTPSGet}={}){
 const proof=validateDomainChallenge({token,secret,organizationId,now});
 const pinnedIPv4=await resolvePinnedAddress(proof.hostname,lookup);
 const result=await request({hostname:proof.hostname,pinnedIPv4,path:proof.publicationPath,redirect:"deny"});
 if(result?.status!==200||result?.contentType?.split(";")[0].trim().toLowerCase()!=="text/plain"||
  typeof result.body!=="string"||Buffer.byteLength(result.body)>2048||result.body!==proof.nonce)
  throw new Error("Domain challenge not verified");
 return {status:"domain-challenge-verified",domainControlObserved:true,
  hostname:proof.hostname,testedPublicIP:pinnedIPv4,observedAt:new Date(now).toISOString(),
  ...verifiedHold,notice:"Control of one public challenge path was observed; this is not payment, personal identity, ongoing consent, or report delivery proof."};
}
