// Read-only bounded proof of email-sender DNS prerequisites.
// Important: DNS records do NOT prove outbound transport, reputation, actual mail
// receipt, inbox ownership, or permission to activate Hercules confirmation.
import {resolveMx,resolveTxt} from 'node:dns/promises';
import {fileURLToPath} from 'node:url';
const DOMAIN='sauceapproved.com';
function check(values,prefix){
 if(!Array.isArray(values))return false;
 return values.some(v=>Array.isArray(v)&&v.join('').trim().toLowerCase().startsWith(prefix));
}
function presentMx(values){return Array.isArray(values)&&values.some(x=>typeof x.exchange==='string'&&x.exchange.includes('.'))}
export async function inspectCircleMailDomain({
 domain=DOMAIN,
 resolver={resolveMx,resolveTxt}
}={}){
 if(domain!==DOMAIN)throw Error('domain_not_allowlisted');
 if(typeof resolver?.resolveMx!=='function'||typeof resolver?.resolveTxt!=='function')
  throw Error('invalid_resolver');
 const fetchSafe=async fn=>{try{return await fn()}catch(error){
  // NXDOMAIN/ENODATA is a completed lookup without a record; timeouts and
  // transport failures must remain unverified, never treated as absence.
  if(['ENODATA','ENOTFOUND','ENODOMAIN'].includes(error?.code))return [];
  return null;
 }};
 const [mx,txt,dmarc]=await Promise.all([
  fetchSafe(()=>resolver.resolveMx(DOMAIN)),
  fetchSafe(()=>resolver.resolveTxt(DOMAIN)),
  fetchSafe(()=>resolver.resolveTxt('_dmarc.'+DOMAIN))
 ]);
 const state={
  schema:'hercules.circle.mail-domain-readiness.v1',
  domain:DOMAIN,
  mxPresent:mx===null?null:presentMx(mx),
  spfPresent:txt===null?null:check(txt,'v=spf1'),
  dmarcPresent:dmarc===null?null:check(dmarc,'v=dmarc1'),
  observationsComplete:mx!==null&&txt!==null&&dmarc!==null,
  dkimVerified:false,
  smtpTransportVerified:false,
  actualReceiptVerified:false,
  emailConfirmationActive:false,
  readyToSendConfirmation:false,
  liveSubscriberEmailsSent:0,
  noDnsChangesPerformed:true,
  note:'MX/SPF/DMARC visibility cannot establish authorized SMTP, sender identity, DKIM, actual receipt or subscriber confirmation.'
 };
 return Object.freeze(state);
}
export function printMailReadiness(status){return JSON.stringify(status)}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const report=await inspectCircleMailDomain();
  process.stdout.write(printMailReadiness(report)+'\n');
 }catch(error){
  process.stderr.write(JSON.stringify({status:'unverified',reason:String(error.message).slice(0,100)})+'\n');
  process.exitCode=1;
 }
}
