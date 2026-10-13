// Public, publishable-key-only Hercules Cloud interest form.
// No service-role key, private credential, payment processor or account registration.
const endpoint='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-cloud-founders';
const publishableKey='sb_publishable_wB9FvOqAi-JhUQuJrHvczg_C_V4RgCt';
const form=document.getElementById('founders-form');
const result=document.getElementById('founders-result');
const button=document.getElementById('founders-submit');
let inFlight=false;
function announce(text,error=false){
 result.textContent=text;
 result.classList.toggle('error',error);
}
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(inFlight||!form.reportValidity())return;
 const data=new FormData(form);
 const email=String(data.get('email')||'').trim();
 const interest=String(data.get('interest')||'both');
 const website=String(data.get('website')||'');
 if(!email||!form.elements.consent.checked){
   announce('An email address and consent are required.',true);
   return;
 }
 inFlight=true;
 button.disabled=true;
 announce('Recording your interest...');
 const body={email,interest,website,consent:true};
 try{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),8000);
   let response;
   try{
     response=await fetch(endpoint,{
       method:'POST',
       mode:'cors',
       credentials:'omit',
       cache:'no-store',
       signal:controller.signal,
       headers:{'content-type':'application/json',apikey:publishableKey},
       body:JSON.stringify(body)
     });
   }finally{clearTimeout(timeout)}
   const payload=await response.json().catch(()=>({}));
   if(response.ok&&payload?.ok===true){
     announce('Interest recorded. Your address is currently unverified; this does not create a Hercules account or grant hosted access.');
     form.reset();
   }else if(response.status===429){
     announce('The interest list is temporarily full. Please try again later.',true);
   }else{
     announce('We could not record your request. Please try again later.',true);
   }
 }catch{
   announce('Connection unavailable. No registration has been confirmed. Please try again.',true);
 }finally{inFlight=false;button.disabled=false}
});
