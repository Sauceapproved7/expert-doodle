import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCircleMailDomain, printMailReadiness} from '../scripts/hercules_circle_mail_readiness.mjs';

const resolver=(values,calls)=>({
 async resolveMx(host){calls.push(['MX',host]);if(values.mxError)throw Error('provider_timeout');return values.mx??[]},
 async resolveTxt(host){calls.push(['TXT',host]);if(values.txtError)throw Error('provider_timeout');return host.startsWith('_dmarc.')?(values.dmarc??[]):(values.txt??[])}
});

test('mail-related DNS evidence never asserts SMTP or email confirmation',async()=>{
 const calls=[];
 const state=await inspectCircleMailDomain({
  resolver:resolver({
   mx:[{exchange:'mx.example.test',priority:10}],
   txt:[['v=spf1 include:example.test -all']],
   dmarc:[['v=DMARC1; p=reject']]
  },calls)
 });
 assert.deepEqual(calls,[['MX','sauceapproved.com'],['TXT','sauceapproved.com'],['TXT','_dmarc.sauceapproved.com']]);
 assert.equal(state.mxPresent,true);
 assert.equal(state.spfPresent,true);
 assert.equal(state.dmarcPresent,true);
 assert.equal(state.dkimVerified,false);
 assert.equal(state.smtpTransportVerified,false);
 assert.equal(state.actualReceiptVerified,false);
 assert.equal(state.emailConfirmationActive,false);
 assert.equal(state.readyToSendConfirmation,false);
});
test('missing DNS records are observations, not invented verification',async()=>{
 const calls=[];
 const state=await inspectCircleMailDomain({resolver:resolver({mx:[],txt:[],dmarc:[]},calls)});
 assert.equal(state.mxPresent,false);assert.equal(state.spfPresent,false);assert.equal(state.dmarcPresent,false);
 assert.equal(state.readyToSendConfirmation,false);
});
test('resolver errors produce unverified evidence rather than successful DNS assertions',async()=>{
 const calls=[];
 const state=await inspectCircleMailDomain({resolver:resolver({mxError:true,txtError:true},calls)});
 assert.equal(state.mxPresent,null);
 assert.equal(state.spfPresent,null);
 assert.equal(state.dmarcPresent,null);
 assert.equal(state.readyToSendConfirmation,false);
 assert.equal(state.observationsComplete,false);
});
test('cannot probe other domains or arbitrary DNS services',async()=>{
 await assert.rejects(()=>inspectCircleMailDomain({domain:'some-other-domain.com',resolver:resolver({},[])}),/domain_not_allowlisted/);
 await assert.rejects(()=>inspectCircleMailDomain({domain:'sauceapproved.com',resolver:null}),/invalid_resolver/);
});
test('no sender credentials or private DNS TXT record text disclosed in output',async()=>{
 const calls=[];
 const secretLike='v=spf1 include:provider-secret-sensitive -all';
 const state=await inspectCircleMailDomain({
  resolver:resolver({mx:[{exchange:'hidden.internal',priority:0}],txt:[[secretLike]],dmarc:[['v=DMARC1; rua=mailto:private@example.com']]},calls)
 });
 const report=printMailReadiness(state);
 assert.ok(!report.includes(secretLike));
 assert.ok(!report.includes('hidden.internal'));
 assert.ok(!report.includes('private@example.com'));
 assert.equal(JSON.parse(report).readyToSendConfirmation,false);
});


test('authoritative DNS no-data responses count as confirmed absence, not network outage',async()=>{
 const emptyErr=Object.assign(new Error('no DNS records'),{code:'ENODATA'});
 const noData={
  async resolveMx(){throw emptyErr},
  async resolveTxt(){throw emptyErr}
 };
 const state=await inspectCircleMailDomain({resolver:noData});
 assert.equal(state.mxPresent,false);
 assert.equal(state.spfPresent,false);
 assert.equal(state.dmarcPresent,false);
 assert.equal(state.observationsComplete,true);
 assert.equal(state.readyToSendConfirmation,false);
});
