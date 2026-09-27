const $=id=>document.getElementById(id);
const screen=$("screen");
const screenMessage=$("screenMessage");
let active=true;
let refreshTimer=null;
let lastFrameAt=0;

async function api(path,options={}){
  const r=await fetch(path,{cache:"no-store",...options,headers:{"content-type":"application/json",...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||("HTTP "+r.status));
  return data;
}

function setStatus(text){$("status").textContent=text}
function renderPage(page={}){
  $("pageTitle").textContent=page.title||"—";
  $("pageUrl").textContent=page.url||"about:blank";
  if(page.url&&page.url!=="about:blank")$("urlInput").value=page.url;
}

async function refreshStatus(){
  try{
    const s=await api("/api/status");
    $("healthDot").classList.add("live");
    $("healthText").textContent="Live";
    $("sessionState").textContent="Connected";
    $("maxSteps").textContent=s.autopilot?.maxSteps??25;
    $("maxRetries").textContent=s.autopilot?.maxRetries??3;
    const intents=s.autopilot?.intents||[];
    const last=intents[intents.length-1];
    $("checkpoint").textContent=last?.status||"Ready";
    renderPage(s.page);
  }catch(e){
    $("healthDot").classList.remove("live");
    $("healthText").textContent="Auth required";
    $("sessionState").textContent="Locked";
    setStatus(e.message);
  }
}

function refreshFrame(){
  if(!active)return;
  const now=Date.now();
  lastFrameAt=now;
  screen.src="/api/frame?t="+now;
  refreshTimer=setTimeout(refreshFrame,1100);
}

screen.onload=()=>{
  screenMessage.hidden=true;
  setStatus("Live Hercules Chromium session");
};
screen.onerror=()=>{
  screenMessage.hidden=false;
  screenMessage.textContent="Refreshing secure session…";
};

$("navForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const url=$("urlInput").value.trim();
  if(!url)return;
  setStatus("Navigating…");
  try{
    const r=await api("/api/navigate",{method:"POST",body:JSON.stringify({url})});
    renderPage(r.page);
    screenMessage.hidden=false;
    screenMessage.textContent="Loading…";
    screen.src="/api/frame?t="+Date.now();
    setStatus("Navigation complete");
  }catch(err){setStatus(err.message)}
});

screen.addEventListener("pointerdown",async e=>{
  if(!screen.naturalWidth||!screen.naturalHeight)return;
  e.preventDefault();
  const rect=screen.getBoundingClientRect();
  const x=(e.clientX-rect.left)*(screen.naturalWidth/rect.width);
  const y=(e.clientY-rect.top)*(screen.naturalHeight/rect.height);
  try{
    await api("/api/action",{method:"POST",body:JSON.stringify({type:"click",x,y})});
    setStatus("Click sent");
  }catch(err){setStatus(err.message)}
});

$("sendText").onclick=async()=>{
  const el=$("textInput");
  const text=el.value;
  if(!text)return;
  el.value="";
  try{
    const r=await api("/api/action",{method:"POST",body:JSON.stringify({type:"text",text})});
    setStatus("Sent "+r.chars+" characters");
  }catch(err){setStatus(err.message)}
};

$("toggleText").onclick=()=>{
  const el=$("textInput");
  el.type=el.type==="password"?"text":"password";
  $("toggleText").textContent=el.type==="password"?"Show":"Hide";
};

document.querySelectorAll("[data-key]").forEach(btn=>{
  btn.onclick=async()=>{
    try{
      await api("/api/action",{method:"POST",body:JSON.stringify({type:"key",key:btn.dataset.key})});
      setStatus(btn.dataset.key+" sent");
    }catch(err){setStatus(err.message)}
  };
});

$("scrollUp").onclick=()=>api("/api/action",{method:"POST",body:JSON.stringify({type:"scroll",deltaY:-650})}).catch(e=>setStatus(e.message));
$("scrollDown").onclick=()=>api("/api/action",{method:"POST",body:JSON.stringify({type:"scroll",deltaY:650})}).catch(e=>setStatus(e.message));
$("back").onclick=()=>api("/api/action",{method:"POST",body:JSON.stringify({type:"back"})}).then(r=>renderPage(r.page)).catch(e=>setStatus(e.message));
$("forward").onclick=()=>api("/api/action",{method:"POST",body:JSON.stringify({type:"forward"})}).then(r=>renderPage(r.page)).catch(e=>setStatus(e.message));
$("reload").onclick=()=>api("/api/action",{method:"POST",body:JSON.stringify({type:"reload"})}).then(r=>renderPage(r.page)).catch(e=>setStatus(e.message));
$("newSession").onclick=async()=>{
  try{
    const r=await api("/api/new-session",{method:"POST",body:"{}"});
    renderPage(r.page);
    setStatus("New isolated browser session created");
  }catch(e){setStatus(e.message)}
};

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("/sw.js").catch(()=>{});
}

window.addEventListener("visibilitychange",()=>{
  active=!document.hidden;
  if(active){
    clearTimeout(refreshTimer);
    refreshFrame();
    refreshStatus();
  }
});
window.addEventListener("beforeunload",()=>{active=false;clearTimeout(refreshTimer)});

await refreshStatus();
refreshFrame();
setInterval(refreshStatus,5000);
