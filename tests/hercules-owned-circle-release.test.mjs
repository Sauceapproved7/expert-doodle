import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCircleRelease,assertCircleRelease} from '../hercules-deploy/owned-circle/preflight.mjs';

const complete={
 CIRCLE_PUBLIC_URL:'https://circle.example.com',
 CIRCLE_DB_PATH:'/srv/hercules/private/members.sqlite',
 CIRCLE_OWNER_KEY:'a'.repeat(48),CIRCLE_RATE_SECRET:'b'.repeat(48),
 CIRCLE_SMTP_HOST:'smtp.example.com',CIRCLE_SMTP_PORT:'465',
 CIRCLE_SMTP_USER:'sender@example.com',CIRCLE_SMTP_PASSWORD:'password'.repeat(6),
 CIRCLE_FROM_EMAIL:'notify@example.com'
};
const evidence={emailReceiptVerified:true,storageDurabilityVerified:true,
 publicHttpsVerified:true,ownerReleaseApproved:true};

test('fail closed without a provider and persistent storage',()=>{
 const r=evaluateCircleRelease();
 assert.equal(r.ready,false);assert.equal(r.customerSignupsEnabled,false);
 assert.equal(r.paymentEnabled,false);
 assert.ok(r.blockedReasons.includes('persistent_storage_unverified'));
 assert.ok(r.blockedReasons.includes('live_email_receipt_unverified'));
});
test('configured credentials are not proof of real receipt or storage',()=>{
 const r=evaluateCircleRelease(complete);
 assert.equal(r.configurationValid,true);
 assert.equal(r.ready,false);
 assert.equal(r.productionHostingGuaranteed,false);
});
test('reject secret reuse, unsafe URL and missing SMTP',()=>{
 for(const env of [
  {...complete,CIRCLE_PUBLIC_URL:'http://circle.example.com'},
  {...complete,CIRCLE_PUBLIC_URL:'https://localhost'},
  {...complete,CIRCLE_DB_PATH:'./members.sqlite'},
  {...complete,CIRCLE_OWNER_KEY:complete.CIRCLE_RATE_SECRET},
  {...complete,CIRCLE_SMTP_PORT:'25'},
  {...complete,CIRCLE_SMTP_HOST:''}
 ]){
  assert.equal(evaluateCircleRelease(env,evidence).ready,false);
 }
});
test('independent verified checks plus safe configuration permit explicit release',()=>{
 const r=evaluateCircleRelease(complete,evidence);
 assert.equal(r.ready,true);assert.equal(r.customerSignupsEnabled,true);
 assert.equal(r.paymentEnabled,false);
 assert.equal(assertCircleRelease(complete,evidence),r.ready&&assertCircleRelease(complete,evidence));
 assert.throws(()=>assertCircleRelease(complete,{...evidence,ownerReleaseApproved:false}),/not_release_ready/);
});
test('release evidence never echoes sensitive values',()=>{
 const r=JSON.stringify(evaluateCircleRelease(complete,evidence));
 assert.equal(r.includes(complete.CIRCLE_OWNER_KEY),false);
 assert.equal(r.includes(complete.CIRCLE_RATE_SECRET),false);
 assert.equal(r.includes(complete.CIRCLE_SMTP_PASSWORD),false);
});
