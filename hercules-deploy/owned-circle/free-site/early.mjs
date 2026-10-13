// Early-tester INTEREST, not enrollment. No external email service or secret API keys.
const ENDPOINT='https://xbwuablxhhwsaoomsoco.supabase.co/rest/v1/rpc/hercules_circle_request_early';
const API_KEY='sb_publishable_wB9FvOqAi-JhUQuJrHvczg_C_V4RgCt';
const form=document.getElementById('early-form');
const submit=document.getElementById('early-submit');
const status=document.getElementById('early-response');
let sending=false;
const announce=(msg,error=false)=>{
 if(!status)return;
 status.textContent=msg;
 status.classList.toggle('error',error);
};
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(sending||!form.reportValidity())return;
 const values=new FormData(form);
 const email=String(values.get('email')||'').trim();
 const useCase=String(values.get('use_case')||'');
 const stage=String(values.get('project_stage')||'');
 const website=String(values.get('website')||'');
 const consent=values.get('consent')==='on';
 if(!consent||email.length<5||email.length>254
    ||!['software','ecommerce','developer_tools','other'].includes(useCase)
    ||!['idea','prototype','live'].includes(stage)){
   announce('Email, project category, and consent are required.',true);return;
 }
 sending=true;if(submit)submit.disabled=true;
 announce('Recording early interest…');
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  let response;
  try{
   response=await fetch(ENDPOINT,{
    method:'POST',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,
    headers:{apikey:API_KEY,'content-type':'application/json'},
    body:JSON.stringify({
     p_email:email,p_consent:true,p_use_case:useCase,
     p_project_stage:stage,p_website:website
    })
   });
  }finally{clearTimeout(timer)}
  const data=await response.json().catch(()=>({}));
  if(response.ok&&data?.ok===true&&data?.status==='early_interest_unverified'){
   announce('Early interest recorded as unverified. No beta invitation or hosting access has been issued.');
   form.reset();
  }else if(data?.error==='intake_temporarily_full'||response.status===429){
   announce('The early-interest list is temporarily full. Please try again later.',true);
  }else{
   announce('We could not record that request. Nothing has been confirmed.',true);
  }
 }catch{announce('Connection unavailable. No request has been confirmed.',true)}
 finally{sending=false;if(submit)submit.disabled=false}
});
