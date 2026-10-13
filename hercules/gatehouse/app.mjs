const $=id=>document.getElementById(id);
const names=["Shopify","Stripe","Render","Supabase","GitHub","DNS","Hercules MCP","Studio","Smallz","Domain Guard"];
const gateLabels={
 spaceship_authorized:"Spaceship authorization",dns_verified:"Domain DNS",
 shopify_domain_ssl_verified:"Shopify domain / TLS",inventory_verified:"Store inventory",
 payment_provider_live_verified:"Live payment provider",payout_destination_verified:"Payout destination",
 paid_checkout_verified:"Paid checkout proof",refund_verified:"Refund verification",
 owner_launch_approval:"Owner launch authorization"
};
let authenticated=false;
function text(el,value){el.textContent=String(value)}
function node(tag,className,contents){
 const el=document.createElement(tag);if(className)el.className=className;
 if(contents!==undefined)el.textContent=String(contents);return el;
}
function renderServices(signals=[]){
 const container=$("services");container.replaceChildren();
 const lookup=new Map(signals.map(s=>[s.name,s]));
 for(const name of names){
  const signal=lookup.get(name)||{status:"unknown"};
  const card=node("div","service");card.append(node("div","service-name",name));
  const state=signal.status==="reachable"?"reachable":signal.status==="unreachable"?"unreachable":"unknown";
  card.append(node("div","service-state "+state,
   state==="reachable"?"REACHABLE":state==="unreachable"?"NO RESPONSE":"UNKNOWN"));
  container.append(card);
 }
}
function renderGates(missing=Object.keys(gateLabels)){
 const container=$("gate-list");container.replaceChildren();
 for(const [key,label] of Object.entries(gateLabels)){
  const line=node("div","check");line.append(node("span","",label),node("span","",missing.includes(key)?"UNVERIFIED":"CLAIM ONLY"));container.append(line);
 }
}
function renderActivities(id,items,empty){
 const el=$(id);el.replaceChildren();
 if(!items.length){el.textContent=empty;return}
 for(const item of items.slice(0,8)){
  const block=node("div","event",item.title);
  if(item.note)block.append(node("small","",item.note));
  el.append(block);
 }
}
function simulateLocal(scenario){
 const stages=["Mock cart: passed","Mock stock check: passed"];
 if(scenario==="payment-declined")stages.push("Mock payment: blocked");
 else{stages.push("Mock payment: passed");if(scenario==="delivery-failed")stages.push("Mock delivery: blocked");
 else{stages.push("Mock delivery: passed",scenario==="payout-pending"?"Mock payout: blocked":"Mock payout: passed")}}
 return stages.join("\n")+"\n\nSYNTHETIC PREVIEW ONLY. No real money moved.";
}
function preview(){
 renderServices();renderGates();
 $("simulation-output").textContent="Choose a scenario to run an isolated synthetic preview.";
 renderActivities("recovery-actions",[],"Connect owner session for current service observations and advisory recommendations.");
 renderActivities("timeline",[],"No telemetry snapshots yet.");
}
function announce(msg){$("auth-caption").textContent=msg}
async function jsonFetch(path,options={}){
 const res=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});
 let body={};try{body=await res.json()}catch{}
 if(!res.ok)throw Error(body.error||"Request failed");
 return body;
}
async function loadPublic(){
 const data=await jsonFetch("/api/public-summary");
 if(authenticated)return;
 renderServices(data.signals||[]);
 text($("mode-chip"),"PUBLIC READ-ONLY");
 $("mode-chip").className="chip gold";
 text($("probe-chip"),"PUBLIC CONNECTIVITY");
 text($("updated"),"Reachability checked "+new Date(data.refreshedAt).toLocaleTimeString());
 announce("Public service reachability is available without login. Owner access is separately required for evidence history and detailed operations. No production changes can be made here.");
}
async function load(){
 const data=await jsonFetch("/api/dashboard");
 authenticated=true;
 $("owner-access").classList.add("hidden");
 $("logout").classList.remove("hidden");
 text($("mode-chip"),"LIVE READ-ONLY");
 $("mode-chip").className="chip gold";
 text($("probe-chip"),"PUBLIC HEALTH PROBES");
 text($("updated"),"Checked "+new Date(data.refreshedAt).toLocaleTimeString());
 renderServices(data.signals);
 renderGates(data.launch?.gates?.missing||[]);
 text($("gate-stat"),"HOLD");
 text($("events-stat"),data.evidence?.count??0);
 text($("integrity"),data.evidence?.ok===true?"Chain intact":"Unverified");
 text($("count"),data.evidence?.count??0);
 text($("sales-stat"),"—");
 text($("orders"),"Not connected");
 text($("payouts"),"Not connected");
 renderActivities("recovery-actions",(data.recovery?.actions||[]).map(a=>({title:a.service+" / "+a.advice,
  note:"Recommendation only • No production action"})),"No recovery advice.");
 renderActivities("timeline",(data.compare?.changes||[]).map(c=>({title:c.service, note:c.previous+" → "+c.current})),
  "No observed service-state changes yet. Two refreshes are needed.");
}
$("login-form").addEventListener("submit",async ev=>{
 ev.preventDefault();const form=ev.currentTarget;const button=form.querySelector("button");
 button.disabled=true;announce("Checking owner session…");
 try{
  await jsonFetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:$("owner-token").value})});
  $("owner-token").value="";
  await load();
 }catch(e){announce(e.message==="owner-credential-not-configured"
  ?"Owner access is not configured on this isolated deployment. Preview remains available."
  :"Owner access denied or temporarily unavailable. Preview remains synthetic.");}
 finally{button.disabled=false}
});
$("refresh").addEventListener("click",async()=>{
 if(!authenticated){try{await loadPublic()}catch{announce("Public checks unavailable; cached statuses are not verified.")}return}
 try{await load()}catch{announce("Observation refresh failed; cached display should not be considered current.");text($("probe-chip"),"REFRESH FAILED")}
});
$("logout").addEventListener("click",async()=>{
 try{await jsonFetch("/api/logout",{method:"POST"})}catch{}
 authenticated=false;$("owner-access").classList.remove("hidden");$("logout").classList.add("hidden");
 text($("mode-chip"),"PREVIEW MODE");text($("probe-chip"),"AWAITING AUTH");
 text($("updated"),"Not connected");text($("events-stat"),"—");text($("count"),"—");
 text($("integrity"),"Awaiting records");announce("Signed out. All displayed preview statuses are unknown.");
 preview();
 try{await loadPublic()}catch{}
});
$("simulate").addEventListener("click",async()=>{
 const scenario=$("scenario").value;
 if(!authenticated){text($("simulation-output"),simulateLocal(scenario));return}
 try{
  const r=await jsonFetch("/api/simulate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({scenario})});
  const result=r.steps.map(s=>(s.result==="pass"?"PASS ":"BLOCKED ")+s.name).join("\n");
  text($("simulation-output"),result+"\n\nSynthetic: "+r.synthetic+" • Money moved: "+r.moneyMoved+" • Production authorized: "+r.productionAuthorized);
 }catch{text($("simulation-output"),"Synthetic test unavailable. No real transaction was attempted.")}
});
preview();
jsonFetch("/api/session").then(()=>load()).catch(()=>loadPublic().catch(()=>{}));
