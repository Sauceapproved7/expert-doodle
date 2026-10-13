// Hercules Cloud opt-in interest is NOT Hercules public account registration.
// Pure, dependency-free validation shared with repository regression tests.
const EMAIL=/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const ALLOWED_ORIGINS=new Set([
  'https://hercules-cloud-origin-preview.onrender.com'
]);
const ALLOWED_FIELDS=new Set(['email','consent','interest','website']);

function invalid(kind){throw new TypeError('founders_'+kind)}
export function allowedFoundingOrigin(origin){
 if(typeof origin!=='string'||origin.length>160)return false;
 return ALLOWED_ORIGINS.has(origin);
}
export function foundingCapacityReached(count){
 return !Number.isSafeInteger(count)||count<0||count>=200;
}
export function normalizeFoundingInterest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid('invalid_body');
 const fields=Object.keys(input);
 if(fields.length>8||fields.some(key=>!ALLOWED_FIELDS.has(key)))invalid('unexpected_field');
 if(input.consent!==true)invalid('consent_required');
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
 if(email.length<5||email.length>254||!EMAIL.test(email)||email.includes('..'))invalid('email_invalid');
 const interest=input.interest==null?'both':input.interest;
 if(!['software','self-hosted','both'].includes(interest))invalid('interest_invalid');
 const website=input.website==null?'':input.website;
 if(typeof website!=='string'||website.length>255)invalid('honeypot_invalid');
 return Object.freeze({email,interest,honeypot:website.length>0});
}
