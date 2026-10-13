import test from "node:test";
import assert from "node:assert/strict";
import {runVerifiedSiteDiagnostic,buildDiagnosticFindings,renderIllustrativeDiagnostic,headRootPinned} from "./website-diagnostic.mjs";
import {issueDomainChallenge} from "./domain-proof.mjs";

const secret=Buffer.alloc(32,0x61);
const organizationId="a1e57fa8-e6c1-4d34-9e22-61f781915df8";
const now=Date.parse("2026-10-13T16:00:00.000Z");
const challenge=()=>issueDomainChallenge({origin:"https://sample.example.com",organizationId,secret,now,nonce:Buffer.alloc(24,0x7a)});
const lookup=async()=>[{family:4,address:"8.8.8.8"}];
test("verified domain proof permits only pinned root HEAD with bounded header observations and no customer data",async()=>{
 const ch=challenge(),calls=[];
 const result=await runVerifiedSiteDiagnostic({
  token:ch.token,secret,organizationId,now:now+1000,lookup,
  challengeRequest:async args=>{calls.push({method:"GET",args});return {status:200,contentType:"text/plain",body:ch.nonce}},
  headRequest:async args=>{calls.push({method:"HEAD",args});return {
   status:200,headers:{"strict-transport-security":"max-age=31536000","content-security-policy":"default-src 'self'","x-content-type-options":"nosniff",
    "set-cookie":"account=secret","location":"https://private.example.com/key"},
   tlsVerified:true
  }}
 });
 assert.deepEqual(calls.map(c=>c.method),["GET","HEAD"]);
 assert.equal(calls[1].args.method,"HEAD");
 assert.equal(calls[1].args.path,"/");
 assert.equal(calls[1].args.redirect,"deny");
 assert.equal(calls[1].args.hostname,"sample.example.com");
 assert.equal(calls[1].args.pinnedIPv4,"8.8.8.8");
 assert.equal(result.site,"https://sample.example.com");
 assert.equal(result.domainControlObserved,true);
 assert.equal(result.rootHttpStatus,200);
 assert.equal(result.headersObserved.hsts,true);
 assert.equal(result.headersObserved.csp,true);
 assert.equal(result.headersObserved.nosniff,true);
 assert.equal(result.deliveryAuthorized,false);
 assert.equal(result.paidOrderVerified,false);
 assert.equal(result.customerIdentityVerified,false);
 assert.equal(result.productionAuthorized,false);
 assert.equal(result.customerReportReleased,false);
 assert.equal(result.evidenceAttested,false);
 assert.doesNotMatch(JSON.stringify(result),/set-cookie|account=secret|private\.example\.com|8\.8\.8\.8|a1e57fa8/);
});
test("bad or missing ownership proof never triggers customer root checks",async()=>{
 let calls=0;
 await assert.rejects(()=>runVerifiedSiteDiagnostic({
  token:challenge().token+"a",secret,organizationId,now:now+1000,lookup,
  challengeRequest:async()=>{calls++;return {status:200,body:"not important",contentType:"text/plain"}},
  headRequest:async()=>{calls++;return {status:200,headers:{}}}
 }));
 assert.equal(calls,0);
 await assert.rejects(()=>runVerifiedSiteDiagnostic({
  token:challenge().token,secret,organizationId,now:now+1000,
  lookup:async()=>[{family:4,address:"169.254.169.254"}],
  challengeRequest:async()=>{calls++;return {status:200,body:"anything",contentType:"text/plain"}},
  headRequest:async()=>{calls++;return {status:200,headers:{}}}
 }));
 assert.equal(calls,0);
});
test("redirect, unsupported HEAD, and server errors yield restrained advice, not uptime/security guarantees",()=>{
 const redirect=buildDiagnosticFindings({status:302,headers:{"location":"https://secret.example/token"}});
 assert.equal(redirect.httpClass,"redirect-observed");
 assert.equal(redirect.headersObserved.hsts,false);
 assert.ok(redirect.findings.some(x=>x.code==="review-redirect"));
 assert.doesNotMatch(JSON.stringify(redirect),/secret\.example/);
 const noHead=buildDiagnosticFindings({status:405,headers:{}});
 assert.equal(noHead.httpClass,"head-unsupported");
 assert.ok(noHead.findings.some(x=>x.code==="head-unsupported"));
 const bad=buildDiagnosticFindings({status:503,headers:{}});
 assert.equal(bad.httpClass,"server-error-response");
 assert.ok(bad.findings.some(x=>x.code==="server-5xx"));
 const unavailable=buildDiagnosticFindings(null);
 assert.equal(unavailable.httpClass,"not-observed");
 assert.deepEqual(unavailable.headersObserved,{hsts:null,csp:null,nosniff:null});
});
test("root check failure still returns observed domain challenge with no fabricated HTTP result",async()=>{
 const ch=challenge();
 const result=await runVerifiedSiteDiagnostic({
  token:ch.token,secret,organizationId,now:now+1,lookup,
  challengeRequest:async()=>({status:200,contentType:"text/plain",body:ch.nonce}),
  headRequest:async()=>{throw new Error("secret internal host")},
 });
 assert.equal(result.domainControlObserved,true);
 assert.equal(result.rootHttpStatus,null);
 assert.equal(result.httpClass,"not-observed");
 assert.doesNotMatch(JSON.stringify(result),/secret internal/);
 assert.equal(result.deliveryAuthorized,false);
});
test("pinned HEAD adapter rejects unverified destinations before network connections",async()=>{
 for(const ip of ["127.0.0.1","169.254.169.254","::1","192.168.2.1"]){
  await assert.rejects(()=>headRootPinned({hostname:"example.com",pinnedIPv4:ip}));
 }
 await assert.rejects(()=>headRootPinned({hostname:"localhost",pinnedIPv4:"8.8.8.8"}));
 await assert.rejects(()=>headRootPinned({hostname:"example.com",pinnedIPv4:"8.8.8.8",path:"/admin"}));
});
test("illustrative diagnostic always remains simulated and safe for a public page",()=>{
 const html=renderIllustrativeDiagnostic();
 assert.match(html,/ILLUSTRATIVE WEBSITE DIAGNOSTIC/);
 assert.match(html,/Not a customer website scan/);
 assert.match(html,/Not a paid deliverable/);
 assert.match(html,/SauceApproved/);
 assert.doesNotMatch(html,/<script|buyer@example.com|paidOrderVerified.:true/i);
});
