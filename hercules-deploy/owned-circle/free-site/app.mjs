// Hercules-owned Founding Circle. Standalone, static, no third-party mailing app.
// The publishable project identifier is public; this client has NO database owner privileges.
const endpoint='https://xbwuablxhhwsaoomsoco.supabase.co/rest/v1/rpc/hercules_cloud_join_founders';
const publishableKey='sb_publishable_wB9FvOqAi-JhUQuJrHvczg_C_V4RgCt';
const form=document.getElementById('join-form');
const notice=document.getElementById('join-message');
const submit=document.getElementById('join-submit');
let busy=false;
function message(value,error=false){
 if(!notice)return;
 notice.textContent=value;
 notice.classList.toggle('error',error);
}
function validEmail(input){
 const email=String(input||'').trim();
 return email.length>=5&&email.length<=254&&!email.includes('..')
   &&/^[a-z0-9][a-z0-9._+%-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$/i.test(email);
}
form?.addEventListener('submit',async(event)=>{
 event.preventDefault();
 if(busy||!form.reportValidity())return;
 const data=new FormData(form);
 const email=String(data.get('email')||'').trim();
 const interest=String(data.get('interest')||'both');
 const website=String(data.get('website')||'');
 const consent=data.get('consent')==='on';
 if(!validEmail(email)||!consent||!['software','self-hosted','both'].includes(interest)){
  message('A valid email, interest choice and consent are required.',true);
  return;
 }
 busy=true;
 if(submit)submit.disabled=true;
 message('Recording your free interest…');
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  let response;
  try{
   response=await fetch(endpoint,{
    method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
    headers:{'content-type':'application/json',apikey:publishableKey},
    body:JSON.stringify({
      p_email:email,p_interest:interest,p_consent:true,p_website:website
    }),
    signal:controller.signal
   });
  }finally{clearTimeout(timer)}
  const data=await response.json().catch(()=>({}));
  if(response.ok&&data?.ok===true&&data?.status==='interest_recorded_unverified'){
   message('Interest recorded as unverified. You have not been charged, confirmed by email or registered for hosting.');
   form.reset();
  }else if(response.status===429||data?.error==='intake_temporarily_full'){
   message('The free-interest list is temporarily full. Please try later.',true);
  }else{
   message('The connection could not record your interest. Please try again later.',true);
  }
 }catch{
  message('The connection is unavailable. Nothing has been confirmed.',true);
 }finally{
  busy=false;
  if(submit)submit.disabled=false;
 }
});
