const API="https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-integrations";
const ALLOWED_ACTIONS=new Set(["observe","click","type","navigate","close"]);
let polling=false;

function safeUrl(value){
  try{const u=new URL(String(value||""));return u.origin+u.pathname}catch{return ""}
}

async function post(body,sessionToken=""){
  const headers={"content-type":"application/json"};
  if(sessionToken)headers["x-hercules-personal-session"]=sessionToken;
  const r=await fetch(API,{method:"POST",headers,body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||d.detail||("HTTP "+r.status));
  return d;
}

async function loadState(){return (await chrome.storage.local.get(["herculesSessionToken","herculesSessionId","approvedOrigin","tabId"]))||{}}
async function saveState(v){await chrome.storage.local.set(v)}
async function clearState(){await chrome.storage.local.remove(["herculesSessionToken","herculesSessionId","approvedOrigin","tabId"])}

function domAction(command){
  const safePageUrl=(value)=>{try{const u=new URL(String(value||""),location.href);return u.origin+u.pathname}catch{return ""}};
  const {action,payload={}}=command;
  const sensitive=(el)=>{
    if(!el)return false;
    const type=String(el.type||"").toLowerCase();
    const ac=String(el.autocomplete||"").toLowerCase();
    const identity=[el.name,el.id,el.getAttribute?.("aria-label"),el.getAttribute?.("placeholder")].filter(Boolean).join(" ").toLowerCase();
    return type==='password'||ac.includes("one-time-code")||/password|passcode|otp|one.?time|secret|token|recovery code/.test(identity);
  };
  const humanChallenge=(el)=>{
    const text=[el?.innerText,el?.textContent,el?.id,el?.className,el?.getAttribute?.("aria-label")].filter(Boolean).join(" ").toLowerCase();
    return /captcha|recaptcha|hcaptcha|turnstile|verify you are human|human verification|cloudflare challenge/.test(text);
  };
  const redactText=(value)=>{
    const text=String(value||"");
    if(/api\s*secret|secret\s*key|private\s*key|recovery\s*code|one[- ]time\s*code|\botp\b|password/i.test(text))return "[REDACTED SENSITIVE CONTENT]";
    return text;
  };
  const safeObservation=()=>{
    const challenge=[...document.querySelectorAll("iframe,form,div,button")].find(humanChallenge);
    if(challenge)return {ok:false,error:"human_verification_required"};
    const links=[...document.querySelectorAll("a[href]")].slice(0,80).map(a=>({text:redactText((a.innerText||"").trim()).slice(0,180),href:safePageUrl(a.href)}));
    const buttons=[...document.querySelectorAll("button,[role=button],input[type=submit]")].slice(0,80).map((b,i)=>({index:i,text:redactText((b.innerText||b.getAttribute("aria-label")||b.value||"").trim()).slice(0,180)}));
    const fields=[...document.querySelectorAll("input,textarea,select")].slice(0,80).map((el,i)=>({
      index:i,
      tag:el.tagName.toLowerCase(),
      type:String(el.type||""),
      name:redactText(String(el.name||"")).slice(0,120),
      placeholder:redactText(String(el.placeholder||"")).slice(0,160),
      sensitive:sensitive(el)
    }));
    return {ok:true,url:safePageUrl(location.href),title:redactText(document.title),text:redactText((document.body?.innerText||"").slice(0,16000)),links,buttons,fields};
  };

  if(action==="observe")return safeObservation();
  if(action==="navigate")return {ok:true,navigate:String(payload.url||"")};
  if(action==="close")return {ok:true,close:true};

  const selector=String(payload.selector||"").slice(0,500);
  if(!selector)return {ok:false,error:"selector_required"};
  const el=document.querySelector(selector);
  if(!el)return {ok:false,error:"element_not_found"};
  if(humanChallenge(el))return {ok:false,error:"human_verification_required"};
  if(action==="click"){el.click();return {ok:true}}
  if(action==="type"){
    if(sensitive(el))return {ok:false,error:"secret_field_blocked"};
    const value=String(payload.text||"").slice(0,5000);
    el.focus();
    if("value" in el)el.value=value;
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
    return {ok:true,typed:value.length};
  }
  return {ok:false,error:"unsupported_action"};
}

async function executeCommand(tabId,approvedOrigin,command){
  if(!ALLOWED_ACTIONS.has(command.action))return {ok:false,error:"unsupported_action"};
  const permitted=await chrome.permissions.contains({origins:[approvedOrigin+"/*"]});
  if(!permitted)return {ok:false,error:"site_permission_required"};
  const tab=await chrome.tabs.get(tabId).catch(()=>null);
  if(!tab?.url)return {ok:false,error:"approved_tab_unavailable"};
  const currentOrigin=new URL(tab.url).origin;
  if(currentOrigin!==approvedOrigin)return {ok:false,error:"approved_origin_mismatch"};

  if(command.action==="navigate"){
    const target=new URL(String(command.payload?.url||""),tab.url);
    if(target.protocol!=="https:"||target.origin!==approvedOrigin)return {ok:false,error:"navigation_outside_approved_origin"};
    await chrome.tabs.update(tabId,{url:target.href});
    return {ok:true,url:safeUrl(target.href)};
  }
  if(command.action==="close"){
    await chrome.tabs.remove(tabId);
    return {ok:true,closed:true};
  }

  const injected=await chrome.scripting.executeScript({target:{tabId},func:domAction,args:[command]});
  return injected?.[0]?.result||{ok:false,error:"no_result"};
}

async function pollLoop(){
  if(polling)return;
  polling=true;
  try{
    while(true){
      const s=await loadState();
      if(!s.herculesSessionToken||!s.herculesSessionId||!s.tabId||!s.approvedOrigin)break;
      let d;
      try{d=await post({action:"poll"},s.herculesSessionToken)}catch(e){await new Promise(r=>setTimeout(r,2500));continue}
      const cmd=d.command;
      if(!cmd){await new Promise(r=>setTimeout(r,1200));continue}
      let result;
      try{result=await executeCommand(Number(s.tabId),String(s.approvedOrigin),cmd)}
      catch(e){result={ok:false,error:e.message||String(e)}}
      await post({action:"complete",command_id:cmd.id,result},s.herculesSessionToken).catch(()=>{});
      if(cmd.action==="close"){await clearState();break}
    }
  }finally{polling=false}
}

chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
  (async()=>{
    if(msg.action==="share_current_tab"){
      const permitted=await chrome.permissions.contains({origins:[msg.origin+"/*"]});
      if(!permitted)return {ok:false,error:"site_permission_required"};
      const d=await post({
        action:"connect",
        pair_token:String(msg.pairToken||""),
        approved_origin:String(msg.origin||""),
        approved_tab_title:String(msg.title||"").slice(0,240),
        browser_name:"Hercules Personal Browser Bridge"
      });
      await saveState({
        herculesSessionToken:d.session_token,
        herculesSessionId:d.session_id,
        approvedOrigin:msg.origin,
        tabId:msg.tabId
      });
      pollLoop();
      return {ok:true,session_id:d.session_id};
    }
    if(msg.action==="disconnect"){
      const s=await loadState();
      if(s.herculesSessionToken)await post({action:"disconnect"},s.herculesSessionToken).catch(()=>{});
      await clearState();
      return {ok:true};
    }
    return {ok:false,error:"unsupported_message"};
  })().then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message||String(e)}));
  return true;
});

chrome.runtime.onStartup.addListener(()=>pollLoop());
chrome.runtime.onInstalled.addListener(()=>pollLoop());
pollLoop();
