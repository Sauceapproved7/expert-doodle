// Hercules Cloud preview is intentionally local, deterministic and non-executing.
// It does not contact an owner API, read credentials, run Docker, or authorize production.
const form=document.getElementById('preflight');
const target=document.getElementById('preflight-result');
const links=[...document.querySelectorAll('.nav a')];
function line(message,className=''){
 const el=document.createElement('span');
 el.textContent=message;
 if(className)el.className=className;
 target.append(el);
}
function validOrigin(input){
 try{
  const url=new URL(input);
  return url.protocol==='https:' && !url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash;
 }catch{return false}
}
function safeIdentifier(s){return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(s)}
function safeRef(s){return s.length<=512&&s.length>0&&!/[\s?#@]/.test(s)}
let manifest=null;
form?.addEventListener('submit',event=>{
 event.preventDefault();
 target.replaceChildren();
 const data=new FormData(form);
 const request={
  serviceId:String(data.get('serviceId')||'').trim(),
  releaseId:String(data.get('releaseId')||'').trim(),
  sourceCommit:String(data.get('sourceCommit')||'').trim().toLowerCase(),
  artifactFingerprint:String(data.get('artifactFingerprint')||'').trim().toLowerCase(),
  publicOrigin:String(data.get('publicOrigin')||'').trim(),
  target:{kind:'owned_linux',reference:String(data.get('reference')||'').trim()},
  metadata:{source:'hercules-cloud-local-preview'}
 };
 line('> HERCULES / SHADOW DOCK','term-code');
 const formatOk=safeIdentifier(request.serviceId)
  &&safeIdentifier(request.releaseId)
  &&/^[a-f0-9]{40}$/.test(request.sourceCommit)
  &&/^[a-f0-9]{64}$/.test(request.artifactFingerprint)
  &&validOrigin(request.publicOrigin)&&safeRef(request.target.reference);
 if(!formatOk){
  manifest=null;
  line('> request format: REJECTED','term-error');
  line('> exact source SHA, artifact SHA, HTTPS origin and safe identifiers are required','term-warning');
  line('> deployment authorized: NO','term-error');
  return;
 }
 manifest=request;
 line('> source format: ACCEPTED (syntax only)','term-green');
 line('> SHA-1: '+request.sourceCommit.slice(0,12)+'…');
 line('> artifact SHA-256: '+request.artifactFingerprint.slice(0,16)+'…');
 line('> registered sandbox target: NOT VERIFIED','term-warning');
 line('> owner-controlled target allowlist: UNAVAILABLE IN PREVIEW','term-warning');
 line('> zero-new-cost evidence: NOT ATTESTED','term-warning');
 line('> ready for staging: NO','term-error');
 line('> execution authorized: NO','term-error');
 line('> production changes: NONE','term-green');
 line('# Hercules control API must independently check this manifest.','term-note');
 const copy=document.createElement('button');
 copy.type='button'; copy.className='action outline';copy.textContent='Copy reviewed manifest';
 copy.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(JSON.stringify(manifest,null,2));copy.textContent='Manifest copied';}
  catch{copy.textContent='Copy unavailable in this browser';}
 });
 target.append(copy);
});
for(const link of links){
 link.addEventListener('click',()=>{
  for(const item of links)item.removeAttribute('aria-current');
  link.setAttribute('aria-current','page');
 });
}
