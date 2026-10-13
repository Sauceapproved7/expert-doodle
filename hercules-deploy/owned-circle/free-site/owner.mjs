// Owner Vault is read-only. All authorization is enforced again by Supabase RLS.
// Never store tokens or owner passwords beyond the active in-memory session.
const BASE='https://xbwuablxhhwsaoomsoco.supabase.co';
const KEY='sb_publishable_wB9FvOqAi-JhUQuJrHvczg_C_V4RgCt';
const login=document.getElementById('owner-login');
const zone=document.getElementById('auth-zone');
const consoleBox=document.getElementById('owner-console');
const loginMessage=document.getElementById('login-message');
const recordsMessage=document.getElementById('records-message');
let bearer=null,locked=false;
const say=(node,msg)=>{if(node)node.textContent=msg};
const safeDate=date=>{
 const value=new Date(date);
 return Number.isNaN(value.getTime())?'Unknown':value.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric'});
};
function cell(value,className){
 const el=document.createElement('span');
 el.className=className;
 el.textContent=String(value??'');
 return el;
}
function renderRows(target,items,fields){
 const node=document.getElementById(target);
 if(!node)return;
 node.replaceChildren();
 if(!Array.isArray(items)||items.length===0){
  node.append(cell('No records yet.','empty'));
  return;
 }
 for(const item of items){
  const row=document.createElement('div');row.className='record-row';
  for(const field of fields){
   const value=field==='consent_at'?safeDate(item[field]):item[field];
   row.append(cell(value,field==='email'?'record-email':'record-meta'));
  }
  node.append(row);
 }
}
async function ownerGet(path,token){
 const response=await fetch(BASE+path,{
  method:'GET',credentials:'omit',cache:'no-store',
  headers:{apikey:KEY,authorization:'Bearer '+token,accept:'application/json'}
 });
 if(!response.ok)throw new Error('owner_request_denied');
 const data=await response.json();
 if(!Array.isArray(data))throw new Error('invalid_owner_response');
 return data;
}
async function readOwnerRecords(token){
 const acl=await ownerGet('/rest/v1/hercules_circle_owner_acl?select=user_id&limit=1',token);
 if(acl.length!==1)throw new Error('owner_not_authorized');
 const [founders,early]=await Promise.all([
  ownerGet('/rest/v1/hercules_cloud_founders?select=email,interest,consent_at,status&order=consent_at.desc&limit=100',token),
  ownerGet('/rest/v1/hercules_circle_early_requests?select=email,use_case,project_stage,consent_at,status&order=consent_at.desc&limit=100',token)
 ]);
 if(token!==bearer)return;
 document.getElementById('founder-count').textContent=String(founders.length)+(founders.length===100?'+':'');
 document.getElementById('early-count').textContent=String(early.length)+(early.length===100?'+':'');
 renderRows('founder-rows',founders,['email','interest','consent_at','status']);
 renderRows('early-rows',early,['email','use_case','project_stage','consent_at','status']);
 say(recordsMessage,founders.length===100||early.length===100?'Showing the most recent 100 records per category.':'Owner-authorized records loaded.');
}
function lockVault(){
 bearer=null;
 if(zone)zone.hidden=false;
 if(consoleBox)consoleBox.hidden=true;
 const pwd=document.getElementById('owner-password');
 if(pwd)pwd.value='';
 say(loginMessage,'Owner Vault locked.');
}
login?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(locked||!login.reportValidity())return;
 locked=true;
 const data=new FormData(login);
 const email=String(data.get('email')||'').trim();
 const password=String(data.get('password')||'');
 say(loginMessage,'Verifying the existing owner identity…');
 const submit=login.querySelector('button[type=submit]');
 if(submit)submit.disabled=true;
 try{
  const response=await fetch(BASE+'/auth/v1/token?grant_type=password',{
    method:'POST',credentials:'omit',cache:'no-store',
    headers:{apikey:KEY,'content-type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const answer=await response.json().catch(()=>({}));
  if(!response.ok||typeof answer.access_token!=='string'){
   throw new Error('owner_authentication_denied');
  }
  bearer=answer.access_token;
  await readOwnerRecords(bearer);
  if(zone)zone.hidden=true;
  if(consoleBox)consoleBox.hidden=false;
 }catch{
  bearer=null;
  say(loginMessage,'Owner access could not be verified. No subscriber records were disclosed.');
 }finally{
  const pwd=document.getElementById('owner-password');
  if(pwd)pwd.value='';
  if(submit)submit.disabled=false;
  locked=false;
 }
});
document.getElementById('owner-logout')?.addEventListener('click',lockVault);
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden'&&bearer)lockVault();
});
