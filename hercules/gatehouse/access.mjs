/** First-party customer sign-in. No localStorage, sessionStorage, redirect tokens or third-party scripts. */
const $=id=>document.getElementById(id);
const message=$("auth-message");
const sendForm=$("email-code-form");
const verifyForm=$("verify-code-form");
let enabled=false;
function notice(text){message.textContent=text}
function active(on){
 enabled=on===true;
 $("customer-email").disabled=!enabled;
 $("send-email-code").disabled=!enabled;
 $("customer-code").disabled=!enabled;
 $("verify-email-code").disabled=!enabled;
 $("auth-banner").textContent=enabled
  ?"Existing account email sign-in is available. Purchases and report delivery remain closed."
  :"Enrollment is not open yet. No email will be sent while the access gate is closed.";
}
async function send(path,body){
 const res=await fetch(path,{method:"POST",credentials:"same-origin",
  headers:{"content-type":"application/json","x-gatehouse-request":"1"},
  body:JSON.stringify(body)});
 const result=await res.json().catch(()=>({}));
 return {ok:res.ok,status:res.status,result};
}
async function initialize(){
 try{
  const res=await fetch("/api/customer/auth/capability",{credentials:"same-origin",cache:"no-store"});
  const state=await res.json();
  active(state.emailCodeEnabled===true);
  if(!enabled){notice("Customer login is not yet enabled. Nothing is submitted while disabled.");return}
  const session=await fetch("/api/customer/auth/session",{credentials:"same-origin",cache:"no-store"});
  if(session.ok){
   const details=await session.json();
   if(details.signedIn===true){
    sendForm.hidden=true;verifyForm.hidden=true;$("customer-logout").hidden=false;
    notice("Signed in to an existing account. Customer onboarding and purchases are not yet enabled.");
   }
  }
 }catch{active(false);notice("Account access is currently unavailable. No information was sent.")}
}
sendForm.addEventListener("submit",async event=>{
 event.preventDefault();if(!enabled)return;
 const address=$("customer-email").value.trim();
 $("send-email-code").disabled=true;
 try{
  const sent=await send("/api/customer/auth/request-code",{email:address});
  notice(sent.ok?"If an existing account is eligible, check its email for a code. No new account was created."
    :sent.status===429?"Try requesting a code later.":"Code request unavailable. No account was created.");
 }catch{notice("Email-code service unavailable.")}
 finally{$("send-email-code").disabled=!enabled}
});
verifyForm.addEventListener("submit",async event=>{
 event.preventDefault();if(!enabled)return;
 $("verify-email-code").disabled=true;
 try{
  const attempt=await send("/api/customer/auth/verify-code",{
   email:$("customer-email").value.trim(),code:$("customer-code").value.trim()
  });
  if(attempt.ok&&attempt.result.signedIn===true){
   $("customer-code").value="";
   sendForm.hidden=true;verifyForm.hidden=true;$("customer-logout").hidden=false;
   notice("Existing customer identity verified. Website submissions, checkout and report delivery remain closed.");
  }else notice("Verification not confirmed. Check the code or request a new one.");
 }catch{notice("Verification service unavailable.")}
 finally{$("verify-email-code").disabled=!enabled}
});
$("customer-logout").addEventListener("click",async()=>{
 try{await fetch("/api/customer/auth/logout",{method:"POST",credentials:"same-origin",
  headers:{"x-gatehouse-request":"1"}});}catch{}
 $("customer-logout").hidden=true;sendForm.hidden=false;verifyForm.hidden=false;
 $("customer-code").value="";notice("Signed out of Gatehouse.");
});
initialize();
