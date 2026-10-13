import test from "node:test";
import assert from "node:assert/strict";
import {issueDomainChallenge,validateDomainChallenge,isPublicIPv4,verifyDomainChallenge,resolvePinnedAddress} from "./domain-proof.mjs";

const secret=Buffer.alloc(32,0x5a);
const org="11111111-2222-4333-8444-555555555555";
const fakeNow=Date.parse("2026-10-13T15:00:00.000Z");
const valid=()=>issueDomainChallenge({
 origin:"https://shop.example.com",organizationId:org,secret,now:fakeNow,
 nonce:Buffer.alloc(24,0x44)
});

test("random signed domain challenges are scoped to authorized org, hostname and 15 minute deadline",()=>{
 const a=valid();
 assert.equal(a.hostname,"shop.example.com");
 assert.equal(a.publicationPath,"/.well-known/sauceapproved-gatehouse/"+a.nonce+".txt");
 assert.equal(a.expiresAt,"2026-10-13T15:15:00.000Z");
 assert.equal(a.verified,false);
 assert.equal(a.authorizedCustomerRequest,false);
 assert.equal(a.customerWebsiteProbed,false);
 assert.equal(a.deliveryAuthorized,false);
 assert.ok(a.token.length>100);
 const decoded=validateDomainChallenge({token:a.token,secret,organizationId:org,now:fakeNow});
 assert.equal(decoded.hostname,"shop.example.com");
 assert.equal(decoded.nonce,a.nonce);
 assert.throws(()=>validateDomainChallenge({token:a.token,secret,organizationId:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",now:fakeNow}));
 assert.throws(()=>validateDomainChallenge({token:a.token,secret,organizationId:org,now:fakeNow+900001}));
});
test("challenge tokens cannot be forged, tampered with or accepted with the wrong secret",()=>{
 const challenge=valid();
 assert.throws(()=>validateDomainChallenge({token:challenge.token+"A",secret,organizationId:org,now:fakeNow}));
 assert.throws(()=>validateDomainChallenge({token:challenge.token,secret:Buffer.alloc(32,1),organizationId:org,now:fakeNow}));
 assert.throws(()=>issueDomainChallenge({origin:"http://example.com",secret,organizationId:org,now:fakeNow}));
 assert.throws(()=>issueDomainChallenge({origin:"https://example.com/private",secret,organizationId:org,now:fakeNow}));
 assert.throws(()=>issueDomainChallenge({origin:"https://example.com",secret:Buffer.alloc(2),organizationId:org,now:fakeNow}));
 assert.throws(()=>issueDomainChallenge({origin:"https://example.com",secret,organizationId:"wrong",now:fakeNow}));
});
test("rejects private, reserved, loopback, documentation, metadata and IPv6 addresses",()=>{
 const rejected=["127.0.0.1","10.0.1.2","172.16.0.4","172.31.255.2","192.168.1.1","169.254.169.254","100.64.0.1","0.1.1.1","192.0.2.4","198.51.100.25","203.0.113.12","198.18.0.1","224.0.0.1","240.0.0.1","255.255.255.255","::1","::ffff:127.0.0.1","fe80::1","127.00.0.1","1.2.3.999"];
 for(const ip of rejected)assert.equal(isPublicIPv4(ip),false,ip);
 for(const ip of ["1.1.1.1","8.8.8.8","9.9.9.9","23.45.67.89"])assert.equal(isPublicIPv4(ip),true,ip);
});
test("DNS is pinned to one public IPv4 and fails if ANY returned record is unsafe",async()=>{
 assert.equal(await resolvePinnedAddress("example.com",async()=>[{address:"1.1.1.1",family:4},{address:"8.8.8.8",family:4}]),"1.1.1.1");
 for(const answers of [[{address:"1.1.1.1",family:4},{address:"127.0.0.1",family:4}],[{address:"::1",family:6}],[],[{address:"169.254.169.254",family:4}]]){
  await assert.rejects(()=>resolvePinnedAddress("example.com",async()=>answers));
 }
});
test("verified, pinned, no-redirect HTTPS response confirms only challenge control, never payment or fulfillment",async()=>{
 const ch=valid();
 const calls=[];
 const out=await verifyDomainChallenge({
  token:ch.token,secret,organizationId:org,now:fakeNow+1000,
  lookup:async hostname=>{calls.push({kind:"dns",hostname});return [{address:"8.8.8.8",family:4}]},
  request:async args=>{calls.push({kind:"request",args});return {status:200,contentType:"text/plain",body:ch.nonce}}
 });
 assert.equal(out.status,"domain-challenge-verified");
 assert.equal(out.domainControlObserved,true);
 assert.equal(out.customerIdentityVerified,false);
 assert.equal(out.paidOrderVerified,false);
 assert.equal(out.deliveryAuthorized,false);
 assert.equal(out.purchaseEnabled,false);
 assert.equal(out.testedPublicIP,"8.8.8.8");
 assert.equal(calls[1].args.hostname,"shop.example.com");
 assert.equal(calls[1].args.pinnedIPv4,"8.8.8.8");
 assert.equal(calls[1].args.path,ch.publicationPath);
 assert.equal(calls[1].args.redirect,"deny");
});
test("redirects, wrong MIME, wrong nonce, oversized or forbidden response do not verify",async()=>{
 const ch=valid(),lookup=async()=>[{address:"1.1.1.1",family:4}];
 for(const result of [
  {status:301,contentType:"text/plain",body:ch.nonce},
  {status:200,contentType:"text/html",body:ch.nonce},
  {status:200,contentType:"text/plain",body:"forged"},
  {status:200,contentType:"text/plain",body:ch.nonce+"x"},
  {status:200,contentType:"text/plain",body:"x".repeat(5000)},
  {status:403,contentType:"text/plain",body:ch.nonce}
 ]){
  await assert.rejects(()=>verifyDomainChallenge({token:ch.token,secret,organizationId:org,now:fakeNow,lookup,request:async()=>result}));
 }
});
test("a failed DNS resolution never opens a network connection",async()=>{
 const ch=valid();let requests=0;
 await assert.rejects(()=>verifyDomainChallenge({token:ch.token,secret,organizationId:org,now:fakeNow,
  lookup:async()=>[{address:"169.254.169.254",family:4}],
  request:async()=>{requests++;return {status:200,contentType:"text/plain",body:ch.nonce}}}));
 assert.equal(requests,0);
});
