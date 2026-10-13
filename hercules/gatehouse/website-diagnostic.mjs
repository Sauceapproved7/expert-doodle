/** Hercules Gatehouse bounded, owner-proof-gated diagnostic core.
 * No public customer probe routes, no payment/fulfillment, no arbitrary URL following.
 */
import https from "node:https";
import {normalizeIntake} from "./commerce.mjs";
import {isPublicIPv4,verifyDomainChallenge} from "./domain-proof.mjs";

const MARKS=Object.freeze([
 ["strict-transport-security","hsts"],
 ["content-security-policy","csp"],
 ["x-content-type-options","nosniff"]
]);

export function buildDiagnosticFindings(head){
 const status=Number.isInteger(head?.status)&&head.status>=100&&head.status<=599?head.status:null;
 if(status===null)return {
  httpClass:"not-observed",
  headersObserved:{hsts:null,csp:null,nosniff:null},
  findings:[{code:"head-unavailable",level:"info",text:"Root HEAD request was not observed. A manual test may be needed."}]
 };
 const headers=head?.headers&&typeof head.headers==="object"?head.headers:{};
 const seen=Object.fromEntries(MARKS.map(([key,name])=>[name,
  typeof headers[key]==="string"&&headers[key].trim().length>0]));
 const httpClass=status>=500?"server-error-response":
  status===405?"head-unsupported":
  status>=300&&status<400?"redirect-observed":
  status>=400?"client-error-response":
  status>=200&&status<300?"response-observed":"other-response";
 const findings=[];
 if(status>=500)findings.push({code:"server-5xx",level:"review",text:"Server returned a 5xx to HEAD. Investigate the cause; this single response is not uptime measurement."});
 if(status===405)findings.push({code:"head-unsupported",level:"info",text:"HEAD is not supported at the root. Manual GET testing may be needed."});
 if(status>=300&&status<400)findings.push({code:"review-redirect",level:"info",text:"Root returned a redirect. No redirect target was followed or assessed."});
 if(status>=400&&status<500&&status!==405)findings.push({code:"client-4xx",level:"review",text:"Root returned a 4xx response to HEAD; review the intended access behavior."});
 if(!seen.hsts)findings.push({code:"hsts-not-observed",level:"review",text:"Strict-Transport-Security was not observed in the HEAD response. Review configuration; other responses may differ."});
 if(!seen.csp)findings.push({code:"csp-not-observed",level:"review",text:"Content-Security-Policy was not observed in the HEAD response. Review appropriate content security controls."});
 if(!seen.nosniff)findings.push({code:"nosniff-not-observed",level:"review",text:"X-Content-Type-Options was not observed in the HEAD response. Review the nosniff policy."});
 return {httpClass,headersObserved:seen,findings:findings.slice(0,6)};
}

/** Fixed root HEAD only. Vetted public IPv4 is pinned under proper TLS hostname validation.
 * Does not follow redirects or read response body. HEAD may be unsupported by valid sites.
 */
export function headRootPinned({hostname,pinnedIPv4,path="/",method="HEAD",timeoutMs=4500,redirect="deny"}={}){
 const normal=normalizeIntake({website:"https://"+hostname,authorized:true});
 if(new URL(normal.website).hostname!==hostname||!isPublicIPv4(pinnedIPv4)||path!=="/"||method!=="HEAD"||redirect!=="deny"||
  !Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>5000)
  return Promise.reject(new TypeError("Unsafe diagnostic destination"));
 return new Promise((resolve,reject)=>{
  const req=https.request({
   protocol:"https:",hostname,port:443,method:"HEAD",path:"/",agent:false,
   servername:hostname,rejectUnauthorized:true,timeout:timeoutMs,maxHeaderSize:8192,
   lookup:(_host,_options,cb)=>cb(null,pinnedIPv4,4),
   headers:{accept:"text/html,*/*;q=0.1","user-agent":"Hercules-Gatehouse-ReadOnly-Diagnostic/1.0"}
  },res=>{
   // Raw set-cookie, Location, server banners, response bodies and IP are discarded.
   const headers={};
   for(const [key] of MARKS){
    const value=res.headers[key];
    if(typeof value==="string"&&value.trim())headers[key]="observed";
   }
   res.resume();
   res.on("end",()=>resolve({status:res.statusCode,headers,tlsVerified:true}));
   res.on("error",reject);
  });
  req.on("timeout",()=>req.destroy(new Error("Diagnostic timeout")));
  req.on("error",reject);
  req.end();
 });
}

export async function runVerifiedSiteDiagnostic({
 token,secret,organizationId,now=Date.now(),lookup,challengeRequest,headRequest=headRootPinned
}={}){
 // This internally re-verifies the signed, unexpired domain-control challenge first.
 // A caller-supplied "verified:true" or customer consent flag has no effect.
 const verified=await verifyDomainChallenge({token,secret,organizationId,now,lookup,request:challengeRequest});
 let response=null;
 try{
  response=await headRequest({
   hostname:verified.hostname,pinnedIPv4:verified.testedPublicIP,
   path:"/",method:"HEAD",redirect:"deny",timeoutMs:4500
  });
 }catch{}
 const detail=buildDiagnosticFindings(response);
 return {
  schema:"hercules.gatehouse.site-observation.v1",
  site:"https://"+verified.hostname,
  observedAt:new Date(now).toISOString(),
  scope:"Single, non-followed HTTPS HEAD at root after a short-lived website control challenge",
  domainControlObserved:true,
  rootHttpStatus:Number.isInteger(response?.status)?response.status:null,
  ...detail,
  tlsVerifiedByAdapter:response?.tlsVerified===true,
  methodology:"A single response and observed header presence, not an uptime percentage, vulnerability scan, or production assurance.",
  customerIdentityVerified:false,paidOrderVerified:false,
  deliveryAuthorized:false,customerReportReleased:false,
  evidenceAttested:false,productionAuthorized:false,
  needsAuthenticatedConsentAndProviderRecheck:true
 };
}

export function renderIllustrativeDiagnostic(){
 const rows=[
  ["Domain control","Illustrative short-lived public site challenge"],
  ["Network observation","Illustrative HTTPS root HEAD returned HTTP 200"],
  ["HTTP headers","Illustrative HSTS observed; CSP and nosniff not observed"],
  ["Next review","Inspect CSP and nosniff policy; confirm GET behavior manually"]
 ].map(([a,b])=>"<tr><th>"+a+"</th><td>"+b+"</td></tr>").join("");
 return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>SauceApproved Gatehouse — Illustrative Website Diagnostic</title>'+
  '<link rel="stylesheet" href="/report.css"></head><body><main>'+
  '<div class="kicker">SauceApproved / Hercules Gatehouse</div>'+
  '<h1>ILLUSTRATIVE WEBSITE DIAGNOSTIC</h1>'+
  '<p class="warning"><strong>Not a customer website scan.</strong> This example contains fictional observations only. '+
  'Not a paid deliverable, verified order, security certification, uptime guarantee or customer report.</p>'+
  '<table><tbody>'+rows+'</tbody></table>'+
  '<h2>Evidence integrity</h2><p>No live site was scanned to create this example. '+
  'Real diagnostics require independently verified customer consent, domain-control proof, '+
  'private data handling, paid order read-back and verified report delivery.</p>'+
  '<footer>No checkout, payment, refund, DNS change, subscription or customer fulfillment occurred.</footer>'+
  '</main></body></html>';
}
