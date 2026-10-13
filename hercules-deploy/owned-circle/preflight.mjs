// Original Hercules-owned Circle release gate; no provider access or secrets in output.
import {isAbsolute,resolve} from 'node:path';
const originPattern=/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::443)?$/i;
const hostnamePattern=/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;
const mailPattern=/^[a-z0-9][a-z0-9._+%-]*@[a-z0-9.-]+\.[a-z]{2,24}$/i;
const secretValid=s=>typeof s==='string'&&s.length>=32&&s.length<=1024;
function validConfig(env){
 const url=env.CIRCLE_PUBLIC_URL;
 return Boolean(originPattern.test(url??'')
  &&!/localhost|127\.0\.0\.1|\.local$/i.test(new URL(url).hostname)
  &&typeof env.CIRCLE_DB_PATH==='string'&&isAbsolute(env.CIRCLE_DB_PATH)
  &&resolve(env.CIRCLE_DB_PATH)===env.CIRCLE_DB_PATH
  &&/\.sqlite$/.test(env.CIRCLE_DB_PATH)
  &&secretValid(env.CIRCLE_OWNER_KEY)&&secretValid(env.CIRCLE_RATE_SECRET)
  &&env.CIRCLE_OWNER_KEY!==env.CIRCLE_RATE_SECRET
  &&hostnamePattern.test(env.CIRCLE_SMTP_HOST??'')
  &&String(env.CIRCLE_SMTP_PORT||'465')==='465'
  &&typeof env.CIRCLE_SMTP_USER==='string'&&env.CIRCLE_SMTP_USER.length>0
  &&typeof env.CIRCLE_SMTP_PASSWORD==='string'&&env.CIRCLE_SMTP_PASSWORD.length>=16
  &&mailPattern.test(env.CIRCLE_FROM_EMAIL??''));
}
export function evaluateCircleRelease(env={},checks={}){
 const originValid=typeof env.CIRCLE_PUBLIC_URL==='string'&&originPattern.test(env.CIRCLE_PUBLIC_URL);
 const configured=validConfig(env);
 const blockedReasons=[];
 if(!originValid)blockedReasons.push('verified_https_origin_missing');
 if(!secretValid(env.CIRCLE_OWNER_KEY)||!secretValid(env.CIRCLE_RATE_SECRET)||env.CIRCLE_OWNER_KEY===env.CIRCLE_RATE_SECRET)
  blockedReasons.push('independent_owner_secrets_missing');
 if(!hostnamePattern.test(env.CIRCLE_SMTP_HOST??'')||String(env.CIRCLE_SMTP_PORT||'465')!=='465'
   ||!env.CIRCLE_SMTP_USER||!env.CIRCLE_SMTP_PASSWORD||!mailPattern.test(env.CIRCLE_FROM_EMAIL??''))
  blockedReasons.push('private_smtp_missing');
 if(checks.storageDurabilityVerified!==true)blockedReasons.push('persistent_storage_unverified');
 if(checks.emailReceiptVerified!==true)blockedReasons.push('live_email_receipt_unverified');
 if(checks.publicHttpsVerified!==true)blockedReasons.push('public_https_unverified');
 if(checks.ownerReleaseApproved!==true)blockedReasons.push('owner_release_not_approved');
 if(!configured)blockedReasons.push('config_incomplete_or_unsafe');
 const ready=configured&&blockedReasons.length===0;
 return Object.freeze({
  schema:'hercules.circle.release-preflight.v1',configurationValid:configured,ready,
  customerSignupsEnabled:ready,emailDeliveryVerified:checks.emailReceiptVerified===true,
  storageDurabilityVerified:checks.storageDurabilityVerified===true,
  ownerReleaseApproved:checks.ownerReleaseApproved===true,
  productionHostingGuaranteed:false,paymentEnabled:false,blockedReasons,
  limitation:'Independent host/sender proof required; these inputs do not themselves verify an external provider.'
 });
}
export function assertCircleRelease(env,checks){
 const r=evaluateCircleRelease(env,checks);
 if(!r.ready)throw Error('circle_not_release_ready');
 return r;
}
