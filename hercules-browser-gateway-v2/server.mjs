import http from "node:http";
import dns from "node:dns/promises";
import net from "node:net";
import { chromium } from "playwright-core";

const PORT = Number(process.env.PORT || 10000);
const GATEWAY_TOKEN = process.env.HERCULES_GATEWAY_TOKEN || "";
const MAX_BODY = 262144;
const MAX_STEPS = 25;
const MAX_TIMEOUT = 60000;
const SESSION_TTL = 10 * 60 * 1000;
const DNS_CACHE_TTL = 60 * 1000;

const sessions = new Map();
const dnsCache = new Map();
let browserPromise = null;

function reply(res,status,body){
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer"
  });
  res.end(JSON.stringify(body));
}

function auth(req){
  const h=String(req.headers.authorization||"");
  return Boolean(GATEWAY_TOKEN) && h==="Bearer "+GATEWAY_TOKEN;
}

function clamp(v,min,max,fallback){
  const n=Number(v);
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;
}

function ipPrivate(ip){
  if(!ip)return true;
  if(net.isIP(ip)===4){
    const p=ip.split(".").map(Number);
    return p[0]===10 ||
      p[0]===127 ||
      (p[0]===169&&p[1]===254) ||
      (p[0]===172&&p[1]>=16&&p[1]<=31) ||
      (p[0]===192&&p[1]===168) ||
      p[0]===0;
  }
  if(net.isIP(ip)===6){
    const v=ip.toLowerCase();
    return v==="::1" || v==="::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:");
  }
  return true;
}

async function publicHost(hostname){
  const h=String(hostname||"").toLowerCase();
  if(!h || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if(net.isIP(h)) return !ipPrivate(h);

  const cached=dnsCache.get(h);
  if(cached && cached.expires>Date.now()) return cached.allowed;

  try{
    const answers=await dns.lookup(h,{all:true,verbatim:true});
    const allowed=answers.length>0 && answers.every(a=>!ipPrivate(a.address));
    dnsCache.set(h,{allowed,expires:Date.now()+DNS_CACHE_TTL});
    return allowed;
  }catch{
    dnsCache.set(h,{allowed:false,expires:Date.now()+5000});
    return false;
  }
}

async function safe(raw){
  if(typeof raw!=="string"||!raw||raw.length>2048) throw Error("invalid_target_url");
  const u=new URL(raw);
  if(!["http:","https:"].includes(u.protocol)) throw Error("unsupported_protocol");
  if(u.username||u.password) throw Error("embedded_credentials_blocked");
  if(!(await publicHost(u.hostname))) throw Error("private_target_blocked");
  return u.toString();
}

async function networkAllowed(raw){
  try{
    const u=new URL(raw);
    if(["data:","blob:"].includes(u.protocol)) return true;
    if(!["http:","https:"].includes(u.protocol)) return false;
    return publicHost(u.hostname);
  }catch{
    return false;
  }
}

async function body(req){
  const chunks=[];
  let total=0;
  for await(const c of req){
    total+=c.length;
    if(total>MAX_BODY)throw Error("request_too_large");
    chunks.push(c);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):{};
}

async function ensureBrowser(){
  if(browserPromise){
    try{
      const b=await browserPromise;
      if(b.isConnected())return b;
    }catch{}
    browserPromise=null;
  }

  browserPromise=chromium.launch({
    headless:true,
    args:[
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-networking"
    ]
  });

  try{
    const b=await browserPromise;
    b.on("disconnected",()=>{ browserPromise=null; });
    return b;
  }catch(e){
    browserPromise=null;
    throw e;
  }
}

async function fresh(){
  const browser=await ensureBrowser();
  const context=await browser.newContext({
    acceptDownloads:false,
    serviceWorkers:"block"
  });
  const page=await context.newPage();
  await page.route("**/*",async route=>{
    if(await networkAllowed(route.request().url())) return route.continue();
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
  return true;
}

function transientNavigationSnapshot(error){
  const m=error instanceof Error?error.message:String(error||"");
  return /execution context was destroyed/i.test(m) && /navigation/i.test(m);
}

async function snapshot(page,maxChars){
  const max=clamp(maxChars,1000,100000,30000);
  for(let attempt=1;attempt<=3;attempt++){
    try{
      return await page.evaluate(max=>({
        title:document.title,
        url:location.href,
        text:(document.body?.innerText||"").slice(0,max),
        links:Array.from(document.querySelectorAll("a[href]")).slice(0,100).map(a=>({
          text:(a.textContent||"").trim().slice(0,300),
          href:a.href
        }))
      }),max);
    }catch(e){
      if(!transientNavigationSnapshot(e)||attempt===3)throw e;
      await page.waitForTimeout(250*attempt);
      await page.waitForLoadState("domcontentloaded",{timeout:3000}).catch(()=>{});
    }
  }
}

async function navigate(page,url,timeout){
  if(url)await page.goto(await safe(url),{waitUntil:"domcontentloaded",timeout});
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

async function run(x){
  const action=String(x.action||"navigate");
  if(!["navigate","scrape","screenshot","interact","close_session"].includes(action))throw Error("unsupported_action");

  if(action==="close_session"){
    if(!x.sessionId)throw Error("session_id_required");
    return {ok:true,action,closed:await closeSession(String(x.sessionId))};
  }

  const timeout=clamp(x.timeoutMs,1000,MAX_TIMEOUT,30000);
  const persist=x.persistSession===true||Boolean(x.sessionId);
  const s=await session(x.sessionId?String(x.sessionId):null,persist);

  try{
    await navigate(s.page,x.url,timeout);

    if(action==="navigate"){
      return {ok:true,action,sessionId:s.id,page:await snapshot(s.page,x.maxTextChars)};
    }

    if(action==="scrape"){
      const extracted={};
      for(const raw of (Array.isArray(x.selectors)?x.selectors.slice(0,25):[])){
        const sel=String(raw||"").slice(0,500);
        if(sel)extracted[sel]=await extract(s.page,sel);
      }
      return {ok:true,action,sessionId:s.id,page:await snapshot(s.page,x.maxTextChars),extracted};
    }

    if(action==="screenshot"){
      const png=await s.page.screenshot({fullPage:x.fullPage!==false,type:"png"});
      return {
        ok:true,action,sessionId:s.id,contentType:"image/png",
        base64:png.toString("base64"),bytes:png.length,
        page:{title:await s.page.title(),url:s.page.url()}
      };
    }

    const steps=Array.isArray(x.steps)?x.steps.slice(0,MAX_STEPS):[];
    const outputs=[];
    for(const step of steps){
      const type=String(step?.type||"");
      const sel=typeof step?.selector==="string"?step.selector.slice(0,500):"";

      if(type==="click"){
        if(!sel)throw Error("selector_required");
        await s.page.locator(sel).first().click({timeout:Math.min(timeout,10000)});
        outputs.push({type,selector:sel,ok:true});
      }else if(type==="type"){
        if(!sel)throw Error("selector_required");
        const value=String(step?.text||"").slice(0,4000);
        await s.page.locator(sel).first().fill(value,{timeout:Math.min(timeout,10000)});
        outputs.push({type,selector:sel,chars:value.length,ok:true});
      }else if(type==="wait"){
        const ms=clamp(step?.ms,0,5000,500);
        await s.page.waitForTimeout(ms);
        outputs.push({type,ms,ok:true});
      }else if(type==="extract"){
        if(!sel)throw Error("selector_required");
        outputs.push({type,selector:sel,items:await extract(s.page,sel)});
      }else{
        throw Error("unsupported_step");
      }
    }

    return {ok:true,action,sessionId:s.id,steps:outputs,page:await snapshot(s.page,x.maxTextChars)};
  } finally {
    if(!s.persist) await s.context.close().catch(()=>{});
  }
}

setInterval(async()=>{
  const cutoff=Date.now()-SESSION_TTL;
  for(const [id,s] of sessions){
    if(s.lastUsed<cutoff)await closeSession(id);
  }
},60000).unref();

async function shutdown(){
  for(const id of [...sessions.keys()])await closeSession(id);
  if(browserPromise){
    try{(await browserPromise).close()}catch{}
  }
  process.exit(0);
}
process.on("SIGTERM",shutdown);
process.on("SIGINT",shutdown);

http.createServer(async(req,res)=>{
  const u=new URL(req.url||"/","http://localhost");

  if(req.method==="GET"&&u.pathname==="/health"){
    return reply(res,200,{
      ok:true,
      service:"hercules-browser-gateway-v2",
      engine:"playwright-local-chromium",
      rawCodeExecution:false,
      sessionReuse:true,
      antiBotBypass:false
    });
  }

  if(req.method!=="POST"||u.pathname!=="/v1/run")return reply(res,404,{error:"not_found"});
  if(!auth(req))return reply(res,401,{error:"unauthorized"});

  try{
    return reply(res,200,await run(await body(req)));
  }catch(e){
    const m=e instanceof Error?e.message:"browser_error";
    const bad=[
      "invalid_target_url","unsupported_protocol","embedded_credentials_blocked",
      "private_target_blocked","unsupported_action","unsupported_step",
      "selector_required","session_id_required","request_too_large"
    ].includes(m);
    return reply(res,bad?400:502,{ok:false,error:m.slice(0,1200)});
  }
}).listen(PORT,"0.0.0.0");
