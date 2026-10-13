import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnedConfirmationEngine, evaluateConfirmationDelivery} from '../hercules-deploy/owned-circle/confirmation-engine.mjs';

const email='tester@example.net';
function setup({status='unverified',consent=true,sendFails=false}={}){
 const state={pending:null,verified:false,sends:[],calls:[],status,consent};
 const repository={
  async eligible(address){
   state.calls.push('eligible');
   return address===email&&state.consent&&state.status==='unverified'
    ?{email:address,status:'unverified',consentAt:'2026-10-13T15:00:00Z'}:null;
  },
  async reserve({email,tokenDigest,expiresAt}){
   state.calls.push('reserve');
   if(state.pending)return false;
   state.pending={email,tokenDigest,expiresAt,sent:false};return true;
  },
  async markSent({tokenDigest}){
   state.calls.push('markSent');if(state.pending?.tokenDigest!==tokenDigest)throw Error('token_not_found');
   state.pending.sent=true;
  },
  async revoke({tokenDigest}){
   state.calls.push('revoke');
   if(state.pending?.tokenDigest===tokenDigest)state.pending=null;
  },
  async consume({tokenDigest,now}){
   state.calls.push('consume');
   if(!state.pending||state.pending.tokenDigest!==tokenDigest||!state.pending.sent||now>=state.pending.expiresAt)return null;
   if(state.verified)return null;
   state.verified=true;state.pending=null;return {email,confirmed:true};
  }
 };
 const sender={
  async send({to,link,subject}){
   state.sends.push({to,link,subject});
   if(sendFails)throw Error('smtp_503');
   return {accepted:true};
  }
 };
 const proof={verifiedSender:true,verifiedReceipt:true,durableStore:true,publicHttps:true,ownerApproved:true,verifyPageReachable:true};
 const engine=createOwnedConfirmationEngine({repository,sender,proof,clock:()=>1781373600000,randomBytes:(n)=>Buffer.alloc(n,7),origin:'https://hercules-owned-circle-free.onrender.com'});
 return {state,engine,proof,repository,sender};
}
test('no sender proof fails closed without touching subscriber data',async()=>{
 const x=setup();
 const denied=createOwnedConfirmationEngine({repository:x.repository,sender:x.sender,proof:{...x.proof,verifiedReceipt:false},clock:()=>1781373600000,origin:'https://hercules-owned-circle-free.onrender.com'});
 await assert.rejects(()=>denied.request(email),/confirmation_transport_not_verified/);
 assert.deepEqual(x.state.calls,[]);assert.deepEqual(x.state.sends,[]);
});
test('all requirements must be independently attested, never implicit',()=>{
 const x=setup();
 for(const key of Object.keys(x.proof)){
  const y=evaluateConfirmationDelivery({...x.proof,[key]:false});
  assert.equal(y.ready,false);assert.ok(y.holds.includes(key));
 }
 assert.equal(evaluateConfirmationDelivery(x.proof).ready,true);
 assert.equal(evaluateConfirmationDelivery({}).ready,false);
});
test('prior consent is mandatory, no customer creation or automatic beta access',async()=>{
 const x=setup({consent:false});
 await assert.rejects(()=>x.engine.request(email),/consent_not_recorded/);
 assert.equal(x.state.pending,null);
 assert.deepEqual(x.state.sends,[]);
});
test('issue token to verified sender only, never return secret',async()=>{
 const x=setup();
 const result=await x.engine.request(email);
 assert.deepEqual(result,{ok:true,status:'confirmation_sent_unverified'});
 assert.equal(x.state.sends.length,1);
 assert.equal(x.state.sends[0].to,email);
 assert.match(x.state.sends[0].link,/^https:\/\/hercules-owned-circle-free\.onrender\.com\/verify\.html#[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(result).includes(x.state.sends[0].link));
 assert.equal(x.state.pending.sent,true);
 assert.equal(x.state.pending.tokenDigest.length,64);
 assert.doesNotMatch(x.state.pending.tokenDigest,new RegExp(x.state.sends[0].link.split('#')[1]));
});
test('consume only a genuinely possessed unexpired single-use token',async()=>{
 const x=setup();
 await x.engine.request(email);
 const token=x.state.sends[0].link.split('#')[1];
 const first=await x.engine.confirm(token);
 assert.deepEqual(first,{ok:true,status:'email_confirmed_no_entitlement'});
 await assert.rejects(()=>x.engine.confirm(token),/invalid_or_expired_token/);
 assert.equal(x.state.verified,true);
});
test('reject token guessing and malformed token',async()=>{
 const x=setup();
 await assert.rejects(()=>x.engine.confirm('wrong'),/invalid_or_expired_token/);
 assert.equal(x.state.verified,false);
});
test('sender failures revoke reserved tokens and never mark confirmed',async()=>{
 const x=setup({sendFails:true});
 await assert.rejects(()=>x.engine.request(email),/confirmation_delivery_unavailable/);
 assert.deepEqual(x.state.calls,['eligible','reserve','revoke']);
 assert.equal(x.state.pending,null);
 assert.equal(x.state.verified,false);
});
test('duplicate challenge reservation is fail-closed without another send',async()=>{
 const x=setup();
 await x.engine.request(email);
 await assert.rejects(()=>x.engine.request(email),/confirmation_already_pending/);
 assert.equal(x.state.sends.length,1);
});
test('email boundaries and origin allowlist prevent header/origin attacks',async()=>{
 const x=setup();
 await assert.rejects(()=>x.engine.request('test\nBcc:malicious@example.net'),/invalid_email/);
 assert.throws(()=>createOwnedConfirmationEngine({...x,origin:'https://evil.example'}),/unapproved_confirmation_origin/);
});
test('successful SMTP acceptance still not same as email receipt or verification',async()=>{
 const x=setup();
 const result=await x.engine.request(email);
 assert.equal(result.status,'confirmation_sent_unverified');
 assert.equal(x.state.verified,false);
});
