import http from "node:http";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright-core";

const PORT=Number(process.env.PORT||10000);
const TOKEN=process.env.HERCULES_DIRECT_TOKEN||"";
const OWNER_START_TOKEN=process.env.HERCULES_OWNER_START_TOKEN||"";
const OWNER_START_URL=process.env.HERCULES_OWNER_START_URL||"";
const OWNER_START_TTL=10*60*1000;
const OWNER_START_BORN=Date.now();
let ownerStartConsumed=false;
const MAX_BODY=262144;
const MAX_STEPS=25;
const MAX_TIMEOUT=60000;
const SESSION_TTL=10*60*1000;
const HANDOFF_TTL=10*60*1000;
const HANDOFF_MAX=8;
const DNS_TTL=60*1000;
const sessions=new Map();
const handoffs=new Map();
const handoffIds=new Map();
const dnsCache=new Map();

const PRIVATE_HOST=/^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|::1)$/i;

function reply(res,status,body,headers={}){
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function auth(req){
  const header=String(req.headers.authorization||"");
  return Boolean(TOKEN)&&header==="Bearer "+TOKEN;
}

function handoffHash(token){
  return createHash("sha256").update(String(token||"")).digest("hex");
}

function ownerStartAuthorized(token){
  if(!OWNER_START_TOKEN)return false;
  return handoffHash(token)===handoffHash(OWNER_START_TOKEN);
}

function ownerHeaders(extra={}){
  return {
    "cache-control":"no-store",
    "pragma":"no-cache",
    "referrer-policy":"no-referrer",
    "x-content-type-options":"nosniff",
    "x-frame-options":"DENY",
    "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=()",
    "content-security-policy":"default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    ...extra
  };
}

function publicOrigin(req){
  const proto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0].trim();
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"");
  if(!host)throw new Error("handoff_origin_unavailable");
  return proto+"://"+host;
}

function handoffByToken(token){
  const hash=handoffHash(token);
  const h=handoffs.get(hash);
  if(!h)return null;
  if(h.expiresAt<=Date.now()){
    handoffs.delete(hash);
    handoffIds.delete(h.handoffId);
    return null;
  }
  if(!sessions.has(h.sessionId)){
    handoffs.delete(hash);
    handoffIds.delete(h.handoffId);
    return null;
  }
  return {hash,h};
}

function handoffStatus(id){
  const hash=handoffIds.get(String(id||""));
  if(!hash)return null;
  const h=handoffs.get(hash);
  if(!h)return null;
  if(h.expiresAt<=Date.now()||!sessions.has(h.sessionId)){
    handoffs.delete(hash);
    handoffIds.delete(h.handoffId);
    return null;
  }
  return {
    handoffId:h.handoffId,
    sessionId:h.sessionId,
    opened:Boolean(h.openedAt),
    finished:Boolean(h.finished),
    expiresAt:new Date(h.expiresAt).toISOString()
  };
}

function cleanupHandoffs(){
  const now=Date.now();
  for(const [hash,h] of handoffs){
    if(h.expiresAt<=now||!sessions.has(h.sessionId)){
      handoffs.delete(hash);
      handoffIds.delete(h.handoffId);
    }
  }
}

function createHandoff(req,sessionId){
  const sid=String(sessionId||"");
  const s=sessions.get(sid);
  if(!s)throw new Error("handoff_session_not_found");
  cleanupHandoffs();
  if(handoffs.size>=HANDOFF_MAX)throw new Error("handoff_capacity_reached");
  s.lastUsed=Date.now();

  const token=randomBytes(32).toString("base64url");
  const hash=handoffHash(token);
  const handoffId=crypto.randomUUID();
  const expiresAt=Date.now()+HANDOFF_TTL;
  handoffs.set(hash,{handoffId,sessionId:sid,expiresAt,openedAt:null,finished:false});
  handoffIds.set(handoffId,hash);

  return {
    ok:true,
    handoffId,
    sessionId:sid,
    expiresAt:new Date(expiresAt).toISOString(),
    handoffUrl:publicOrigin(req)+"/owner/"+token
  };
}

function ownerPage(token){
  const p="/owner/"+encodeURIComponent(token);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><title>Hercules Owner Handoff</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#080a0d;color:#f4f5f7;font:15px system-ui,-apple-system,sans-serif}.wrap{max-width:1100px;margin:auto;padding:14px}.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.tag{font-weight:800;letter-spacing:.04em}.muted{color:#9aa3ad}.screen{width:100%;border:1px solid #2a3038;border-radius:14px;background:#111;touch-action:none}.controls{position:sticky;bottom:0;background:#080a0df2;padding:10px 0;display:grid;gap:8px}.row{display:flex;gap:8px;flex-wrap:wrap}button,input{border:1px solid #343b45;border-radius:10px;background:#151a20;color:#fff;padding:12px;font:inherit}button{font-weight:700}input{flex:1;min-width:180px}.primary{background:#f3f5f7;color:#090b0e}.danger{border-color:#6d3740}.status{min-height:20px;color:#9fd3ad}
  </style></head><body><main class="wrap"><div class="bar"><span class="tag">HERCULES OWNER HANDOFF</span><span class="muted">Temporary secure control of the existing Hercules browser session.</span></div><img id="screen" class="screen" alt="Live Hercules browser"><div class="controls"><div id="status" class="status">Connected. Click the page image to focus a field or button.</div><div class="row"><input id="entry" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type into the focused page field"><button id="send" class="primary">Send text</button><button id="show">Show</button></div><div class="row"><button data-key="Tab">Tab</button><button data-key="Enter">Enter</button><button data-key="Backspace">Backspace</button><button id="up">Scroll up</button><button id="down">Scroll down</button><button id="finish" class="danger">Finish handoff</button></div></div></main><script>
  const base=${JSON.stringify(p)},img=document.getElementById("screen"),status=document.getElementById("status"),entry=document.getElementById("entry");
  let active=true,timer=null;
  async function post(path,body){const r=await fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"handoff_failed");return j}
  function refresh(){if(!active)return;img.src=base+"/frame?t="+Date.now();timer=setTimeout(refresh,1100)}
  img.onload=()=>{status.textContent="Live session ready."};
  img.onerror=()=>{status.textContent="Refreshing secure session…"};
  img.addEventListener("click",async e=>{if(!active)return;const r=img.getBoundingClientRect(),x=(e.clientX-r.left)*(img.naturalWidth/r.width),y=(e.clientY-r.top)*(img.naturalHeight/r.height);try{await post("/action",{type:"click",x,y});status.textContent="Clicked."}catch(err){status.textContent=err.message}});
  document.getElementById("send").onclick=async()=>{const text=entry.value;if(!text)return;entry.value="";try{const r=await post("/action",{type:"text",text});status.textContent="Sent "+r.chars+" characters securely."}catch(err){status.textContent=err.message}};
  document.getElementById("show").onclick=()=>{entry.type=entry.type==="password"?"text":"password"};
  document.querySelectorAll("[data-key]").forEach(b=>b.onclick=async()=>{try{await post("/action",{type:"key",key:b.dataset.key});status.textContent="Key sent."}catch(err){status.textContent=err.message}});
  document.getElementById("up").onclick=()=>post("/action",{type:"scroll",deltaY:-560}).catch(e=>status.textContent=e.message);
  document.getElementById("down").onclick=()=>post("/action",{type:"scroll",deltaY:560}).catch(e=>status.textContent=e.message);
  document.getElementById("finish").onclick=async()=>{try{await post("/finish",{});active=false;clearTimeout(timer);entry.value="";status.textContent="Owner checkpoint complete. Hercules can resume this same session."}catch(err){status.textContent=err.message}};
  refresh();
</script></body></html>`;
}

async function ownerAction(h,input){
  if(h.finished)throw new Error("handoff_finished");
  const s=sessions.get(h.sessionId);
  if(!s)throw new Error("handoff_session_not_found");
  s.lastUsed=Date.now();
  const type=String(input?.type||"");

  if(type==="click"){
    const x=clamp(input.x,0,1280,0);
    const y=clamp(input.y,0,800,0);
    await s.page.mouse.click(x,y);
    return {ok:true,type,x,y};
  }
  if(type==="text"){
    const value=String(input?.text||"").slice(0,1024);
    if(!value)throw new Error("handoff_text_required");
    await s.page.keyboard.insertText(value);
    return {ok:true,type,chars:value.length};
  }
  if(type==="key"){
    const key=String(input?.key||"");
    const allowed=new Set(["Tab","Enter","Escape","Backspace","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"]);
    if(!allowed.has(key))throw new Error("handoff_key_blocked");
    await s.page.keyboard.press(key);
    return {ok:true,type,key};
  }
  if(type==="scroll"){
    const deltaY=clamp(input?.deltaY,-1200,1200,0);
    await s.page.mouse.wheel(0,deltaY);
    return {ok:true,type,deltaY};
  }
  throw new Error("handoff_action_unsupported");
}

function clamp(value,min,max,fallback){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;
}

async function readBody(req){
  const chunks=[];
  let total=0;
  for await(const chunk of req){
    total+=chunk.length;
    if(total>MAX_BODY)throw new Error("request_too_large");
    chunks.push(chunk);
  }
  if(!chunks.length)return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function staticHostAllowed(hostname){
  const h=String(hostname||"").toLowerCase();
  return Boolean(h)&&!h.endsWith(".local")&&!h.endsWith(".internal")&&!PRIVATE_HOST.test(h);
}

function privateAddress(address){
  if(!address)return true;
  if(isIP(address)===4){
    const p=address.split(".").map(Number);
    if(p[0]===10||p[0]===127||p[0]===0)return true;
    if(p[0]===169&&p[1]===254)return true;
    if(p[0]===192&&p[1]===168)return true;
    if(p[0]===172&&p[1]>=16&&p[1]<=31)return true;
    return false;
  }
  if(isIP(address)===6){
    const a=address.toLowerCase();
    return a==="::1"||a==="::"||a.startsWith("fc")||a.startsWith("fd")||a.startsWith("fe80:");
  }
  return true;
}

async function publicHost(hostname){
  const host=String(hostname||"").toLowerCase();
  if(!staticHostAllowed(host))return false;
  const now=Date.now();
  const cached=dnsCache.get(host);
  if(cached&&cached.expires>now)return cached.ok;
  if(isIP(host)){
    const ok=!privateAddress(host);
    dnsCache.set(host,{ok,expires:now+DNS_TTL});
    return ok;
  }
  try{
    const answers=await lookup(host,{all:true,verbatim:true});
    const ok=answers.length>0&&answers.every(x=>!privateAddress(x.address));
    dnsCache.set(host,{ok,expires:now+DNS_TTL});
    return ok;
  }catch{
    dnsCache.set(host,{ok:false,expires:now+5000});
    return false;
  }
}

async function safeUrl(raw){
  if(typeof raw!=="string"||!raw||raw.length>2048)throw new Error("invalid_target_url");
  const u=new URL(raw);
  if(!["http:","https:"].includes(u.protocol))throw new Error("unsupported_protocol");
  if(!(await publicHost(u.hostname)))throw new Error("private_target_blocked");
  return u.toString();
}

async function networkAllowed(raw){
  try{
    const u=new URL(raw);
    if(["data:","blob:"].includes(u.protocol))return true;
    if(!["http:","https:"].includes(u.protocol))return false;
    return await publicHost(u.hostname);
  }catch{
    return false;
  }
}

function transientNavigation(error){
  const message=error instanceof Error?error.message:String(error||"");
  return /execution context was destroyed/i.test(message)&&/navigation/i.test(message);
}

async function snapshotOnce(page,maxChars){
  const max=clamp(maxChars,1000,100000,30000);
  return page.evaluate(max=>({
    title:document.title,
    url:location.href,
    text:(document.body?.innerText||"").slice(0,max),
    links:Array.from(document.querySelectorAll("a[href]")).slice(0,100).map(a=>({
      text:(a.textContent||"").trim().slice(0,300),
      href:a.href
    }))
  }),max);
}

async function snapshot(page,maxChars){
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try{return await snapshotOnce(page,maxChars)}
    catch(error){
      last=error;
      if(!transientNavigation(error)||attempt===2)throw error;
      await page.waitForLoadState("domcontentloaded",{timeout:5000}).catch(()=>{});
      await page.waitForTimeout(150);
    }
  }
  throw last;
}

async function fresh(){
  const browser=await chromium.launch({
    headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage"]
  });
  const context=await browser.newContext({
    acceptDownloads:false,
    ignoreHTTPSErrors:false,
    viewport:{width:1280,height:800}
  });
  const page=await context.newPage();
  await page.route("**/*",async route=>{
    if(await networkAllowed(route.request().url()))return route.continue();
    return route.abort("blockedbyclient");
  });
  return {browser,context,page,lastUsed:Date.now()};
}

async function session(id,persist){
  if(id&&sessions.has(id)){
    const s=sessions.get(id);
    s.lastUsed=Date.now();
    return {...s,id,persist:true};
  }
  const s=await fresh();
  if(persist){
    const sid=id||crypto.randomUUID();
    sessions.set(sid,s);
    return {...s,id:sid,persist:true};
  }
  return {...s,id:null,persist:false};
}

async function closeSession(id){
  const s=sessions.get(id);
  if(!s)return false;
  sessions.delete(id);
  await s.context.close().catch(()=>{});
  await s.browser.close().catch(()=>{});
  return true;
}

async function navigate(page,raw,timeout){
  if(!raw)return;
  const url=await safeUrl(raw);
  await page.goto(url,{waitUntil:"domcontentloaded",timeout});
}

async function extract(page,selector){
  const loc=page.locator(selector);
  const count=Math.min(await loc.count(),50);
  const items=[];
  for(let i=0;i<count;i++){
    items.push(await loc.nth(i).evaluate(el=>({
      text:(el.innerText||el.textContent||"").trim().slice(0,10000),
      html:el.outerHTML.slice(0,20000)
    })));
  }
  return items;
}

async function run(input){
  const action=String(input.action||"navigate");
  const supported=new Set(["navigate","scrape","screenshot","interact","close_session"]);
  if(!supported.has(action))throw new Error("unsupported_action");

  if(action==="close_session"){
    if(!input.sessionId)throw new Error("session_id_required");
    return {ok:true,action,closed:await closeSession(String(input.sessionId))};
  }

  if(!input.url&&!input.sessionId)throw new Error("target_url_or_session_id_required");
  const timeout=clamp(input.timeoutMs,1000,MAX_TIMEOUT,30000);
  const persist=input.persistSession===true||Boolean(input.sessionId);
  const s=await session(input.sessionId?String(input.sessionId):null,persist);

  try{
    await navigate(s.page,input.url,timeout);

    if(action==="navigate"){
      return {ok:true,action,sessionId:s.id,page:await snapshot(s.page,input.maxTextChars)};
    }

    if(action==="scrape"){
      const extracted={};
      const selectors=Array.isArray(input.selectors)?input.selectors.slice(0,25):[];
      for(const raw of selectors){
        const sel=String(raw||"").slice(0,500);
        if(sel)extracted[sel]=await extract(s.page,sel);
      }
      return {ok:true,action,sessionId:s.id,page:await snapshot(s.page,input.maxTextChars),extracted};
    }

    if(action==="screenshot"){
      const png=await s.page.screenshot({fullPage:input.fullPage!==false,type:"png"});
      return {
        ok:true,
        action,
        sessionId:s.id,
        contentType:"image/png",
        base64:png.toString("base64"),
        bytes:png.length,
        page:{title:await s.page.title(),url:s.page.url()}
      };
    }

    const steps=Array.isArray(input.steps)?input.steps.slice(0,MAX_STEPS):[];
    const outputs=[];
    for(const step of steps){
      const type=String(step?.type||"");
      const selector=typeof step?.selector==="string"?step.selector.slice(0,500):"";

      if(type==="click"){
        if(!selector)throw new Error("selector_required");
        await s.page.locator(selector).first().click({timeout:Math.min(timeout,10000)});
        outputs.push({type,selector,ok:true});
      }else if(type==="type"){
        if(!selector)throw new Error("selector_required");
        const value=String(step?.text||"").slice(0,4000);
        await s.page.locator(selector).first().fill(value,{timeout:Math.min(timeout,10000)});
        outputs.push({type,selector,chars:value.length,ok:true});
      }else if(type==="wait"){
        const ms=clamp(step?.ms,0,5000,500);
        await s.page.waitForTimeout(ms);
        outputs.push({type,ms,ok:true});
      }else if(type==="extract"){
        if(!selector)throw new Error("selector_required");
        outputs.push({type,selector,items:await extract(s.page,selector)});
      }else{
        throw new Error("unsupported_step");
      }
    }

    return {ok:true,action,sessionId:s.id,steps:outputs,page:await snapshot(s.page,input.maxTextChars)};
  }finally{
    if(!s.persist){
      await s.context.close().catch(()=>{});
      await s.browser.close().catch(()=>{});
    }
  }
}

setInterval(async()=>{
  const cutoff=Date.now()-SESSION_TTL;
  for(const [id,s] of sessions){
    if(s.lastUsed<cutoff)await closeSession(id);
  }
  cleanupHandoffs();
},60000).unref();

http.createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");

  if(req.method==="GET"&&url.pathname.startsWith("/owner-start/")){
    const rawToken=decodeURIComponent(url.pathname.slice("/owner-start/".length));
    if(!OWNER_START_TOKEN||!OWNER_START_URL)return reply(res,404,{error:"owner_start_unconfigured"});
    if(!ownerStartAuthorized(rawToken))return reply(res,404,{error:"owner_start_not_found"});
    if(ownerStartConsumed||Date.now()>OWNER_START_BORN+OWNER_START_TTL){
      return reply(res,410,{error:"owner_start_expired_or_used"});
    }

    try{
      const target=await safeUrl(OWNER_START_URL);
      const result=await run({
        action:"navigate",
        url:target,
        persistSession:true,
        timeoutMs:30000,
        maxTextChars:1000
      });
      const handoff=createHandoff(req,result.sessionId);
      ownerStartConsumed=true;
      res.writeHead(302,ownerHeaders({
        "content-type":"text/plain; charset=utf-8",
        "location":handoff.handoffUrl
      }));
      return res.end("Redirecting to secure Hercules owner handoff.");
    }catch(error){
      const message=error instanceof Error?error.message:"owner_start_failed";
      return reply(res,502,{ok:false,error:message.slice(0,300)});
    }
  }

  if(req.method==="POST"&&url.pathname==="/v1/handoff"){
    if(!auth(req))return reply(res,401,{error:"unauthorized"});
    try{
      const input=await readBody(req);
      return reply(res,200,createHandoff(req,input.sessionId));
    }catch(error){
      const message=error instanceof Error?error.message:"handoff_error";
      return reply(res,400,{ok:false,error:message.slice(0,300)});
    }
  }

  if(req.method==="GET"&&url.pathname.startsWith("/v1/handoff/")&&url.pathname.endsWith("/status")){
    if(!auth(req))return reply(res,401,{error:"unauthorized"});
    const id=decodeURIComponent(url.pathname.slice("/v1/handoff/".length,-"/status".length));
    const state=handoffStatus(id);
    return state?reply(res,200,{ok:true,...state}):reply(res,404,{ok:false,error:"handoff_not_found"});
  }

  if(url.pathname.startsWith("/owner/")){
    const rest=url.pathname.slice("/owner/".length);
    const slash=rest.indexOf("/");
    const rawToken=decodeURIComponent(slash===-1?rest:rest.slice(0,slash));
    const suffix=slash===-1?"":rest.slice(slash);
    const found=handoffByToken(rawToken);
    if(!found)return reply(res,404,{ok:false,error:"handoff_invalid_or_expired"});
    const {h}=found;
    if(!h.openedAt)h.openedAt=Date.now();

    if(req.method==="GET"&&suffix===""){
      res.writeHead(200,ownerHeaders({"content-type":"text/html; charset=utf-8"}));
      return res.end(ownerPage(rawToken));
    }
    if(req.method==="GET"&&suffix==="/frame"){
      if(h.finished)return reply(res,410,{ok:false,error:"handoff_finished"});
      const s=sessions.get(h.sessionId);
      if(!s)return reply(res,410,{ok:false,error:"handoff_session_not_found"});
      s.lastUsed=Date.now();
      const png=await s.page.screenshot({type:"png",fullPage:false});
      res.writeHead(200,ownerHeaders({"content-type":"image/png","content-length":String(png.length)}));
      return res.end(png);
    }
    if(req.method==="POST"&&suffix==="/action"){
      try{
        return reply(res,200,await ownerAction(h,await readBody(req)));
      }catch(error){
        const message=error instanceof Error?error.message:"handoff_action_failed";
        return reply(res,400,{ok:false,error:message.slice(0,300)});
      }
    }
    if(req.method==="POST"&&suffix==="/finish"){
      h.finished=true;
      const s=sessions.get(h.sessionId);
      if(s)s.lastUsed=Date.now();
      return reply(res,200,{ok:true,finished:true,handoffId:h.handoffId,sessionId:h.sessionId});
    }
    return reply(res,404,{error:"not_found"});
  }

  if(req.method==="GET"&&url.pathname==="/health"){
    return reply(res,200,{
      ok:true,
      service:"hercules-browser-direct",
      engine:"playwright-direct-chromium",
      actions:["navigate","scrape","screenshot","interact","close_session"],
      sessionReuse:true,
      rawCodeExecution:false,
      antiBotBypass:false,
      ownerHandoff:true,
      ownerStartLink:true
    });
  }

  if(req.method!=="POST"||url.pathname!=="/v1/run")return reply(res,404,{error:"not_found"});
  if(!auth(req))return reply(res,401,{error:"unauthorized"});

  try{
    return reply(res,200,await run(await readBody(req)));
  }catch(error){
    const message=error instanceof Error?error.message:"browser_error";
    const bad=[
      "invalid_target_url","unsupported_protocol","private_target_blocked",
      "unsupported_action","unsupported_step","selector_required",
      "session_id_required","target_url_or_session_id_required","request_too_large"
    ].includes(message);
    return reply(res,bad?400:502,{ok:false,error:message.slice(0,1200)});
  }
}).listen(PORT,"0.0.0.0");
