// HERCULES OWNED CIRCLE / ORIGINAL CONFIRMATION ENGINE
// Zero third-party mail SDKs. This module is NOT connected to the live
// membership site and cannot send without an explicitly verified sender.
// The durable repository and mail transport are injected separately.
import {createHash,randomBytes as secureBytes} from 'node:crypto';

const ALLOWED_ORIGIN='https://hercules-owned-circle-free.onrender.com';
const RULES=Object.freeze([
 'verifiedSender','verifiedReceipt','durableStore','publicHttps','ownerApproved','verifyPageReachable'
]);
const ADDRESS=/^[a-z0-9][a-z0-9._+%-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$/;
const TOKEN=/^[a-f0-9]{64}$/;
const HOUR=3600000;
const normalizeEmail=(input)=>{
 if(typeof input!=='string')throw Error('invalid_email');
 const email=input.trim().toLowerCase();
 if(email.length<5||email.length>254||email.includes('..')||!ADDRESS.test(email))throw Error('invalid_email');
 return email;
};
function hashToken(token){
 return createHash('sha256').update('hercules-circle-confirmation-v1\0'+token).digest('hex');
}
export function evaluateConfirmationDelivery(proof={}){
 const holds=RULES.filter(k=>proof?.[k]!==true);
 return Object.freeze({
  schema:'hercules.owned-circle.confirmation-readiness.v1',
  ready:holds.length===0,
  holds,
  confirmationCurrentlyActive:false,
  note:'External verification evidence must be established independently. Inputs alone are not proof.'
 });
}
export function createOwnedConfirmationEngine({
 repository,sender,proof,origin,clock=Date.now,randomBytes=secureBytes
}={}){
 if(origin!==ALLOWED_ORIGIN)throw Error('unapproved_confirmation_origin');
 if(!repository||['eligible','reserve','markSent','revoke','consume'].some(k=>typeof repository[k]!=='function'))
  throw Error('private_confirmation_repository_required');
 if(!sender||typeof sender.send!=='function')throw Error('independent_email_sender_required');
 if(typeof clock!=='function'||typeof randomBytes!=='function')throw Error('invalid_clock_or_entropy');
 async function request(address){
  const email=normalizeEmail(address);
  if(!evaluateConfirmationDelivery(proof).ready)throw Error('confirmation_transport_not_verified');
  // A public form alone does not prove user consent or establish email ownership.
  const existing=await repository.eligible(email);
  if(!existing||existing.status!=='unverified'||!existing.consentAt)
   throw Error('consent_not_recorded');
  const tokenBytes=randomBytes(32);
  if(!Buffer.isBuffer(tokenBytes)||tokenBytes.length!==32)
   throw Error('invalid_random_token');
  const token=tokenBytes.toString('hex');
  const tokenDigest=hashToken(token);
  const issuedAt=clock();
  if(!Number.isSafeInteger(issuedAt)||issuedAt<0)throw Error('invalid_clock');
  const expiresAt=issuedAt+24*HOUR;
  // Atomic persistence / rate caps are the responsibility of the injected
  // owner-controlled durable adapter. Never return raw token from this API.
  const reserved=await repository.reserve({email,tokenDigest,issuedAt,expiresAt});
  if(reserved!==true)throw Error('confirmation_already_pending');
  const link=origin+'/verify.html#'+token;
  try{
   const result=await sender.send({
    to:email,
    link,
    subject:'Confirm your free Hercules Founding Circle interest',
    text:[
     'Hercules Founding Circle — email verification',
     'Confirm this requested address using the single-use link:',
     link,
     'This link expires in 24 hours.',
     'This does not grant hosting, a beta invitation, a membership account, or a paid service.',
     'If you did not request this, disregard the message.'
    ].join('\n')
   });
   if(result?.accepted!==true)throw Error('smtp_delivery_rejected');
   await repository.markSent({email,tokenDigest,at:clock()});
  }catch{
   try{await repository.revoke({email,tokenDigest})}catch{
    // Revoke failed: never claim success or that the token was persisted safely.
   }
   throw Error('confirmation_delivery_unavailable');
  }
  // SMTP acceptance is not proof an inbox received the mail.
  return {ok:true,status:'confirmation_sent_unverified'};
 }
 async function confirm(token){
  if(typeof token!=='string'||!TOKEN.test(token))throw Error('invalid_or_expired_token');
  const digest=hashToken(token);
  const result=await repository.consume({tokenDigest:digest,now:clock()});
  // Durable adapter MUST atomically consume once and commit email verification.
  if(result?.confirmed!==true||typeof result?.email!=='string')
   throw Error('invalid_or_expired_token');
  return {ok:true,status:'email_confirmed_no_entitlement'};
 }
 return Object.freeze({request,confirm});
}
