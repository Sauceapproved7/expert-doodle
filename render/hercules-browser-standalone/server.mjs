import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns/promises";
import net from "node:net";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright-core";

const PORT = Number(process.env.PORT || 10000);
const AUTH_VERIFY_URL = "https://xbwuablxhhwsaoomsoco.supabase.co/rest/v1/rpc/hercules_browser_standalone_token_consume_public";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wB9FvOqAi-JhUQuJrHvczg_C_V4RgCt";
const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));
const MAX_BODY = 256 * 1024;
const MAX_TIMEOUT = 60000;
const SESSION_TTL = 24 * 60 * 60 * 1000;
const AUTOPILOT_MAX_STEPS = 25;
const AUTOPILOT_MAX_RETRIES = 3;
const DNS_CACHE_TTL = 60000;
const VIEWPORT = { width: 1280, height: 800 };

const sessions = new Map();
const autopilotIntents = new Map();
const uiSessions = new Map();
const dnsCache = new Map();
let browserPromise = null;
let ownerSessionId = null;

function json(res,status,body,headers={}) {
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function securityHeaders(extra={}) {
  return {
    "cache-control":"no-store",
    "pragma":"no-cache",
    "referrer-policy":"no-referrer",
    "x-content-type-options":"nosniff",
    "x-frame-options":"DENY",
    "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
    "content-security-policy":"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    ...extra
  };
}

async function verifyBrokerToken(token,expectedPurpose) {
  const value=String(token||"");
  if(!/^[0-9a-f]{64}$/i.test(value))return false;
  try{
    const response=await fetch(AUTH_VERIFY_URL,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "apikey":SUPABASE_PUBLISHABLE_KEY
      },
      body:JSON.stringify({p_token:value}),
      signal:AbortSignal.timeout(7000)
    });
    const data=await response.json().catch(()=>({}));
    return response.ok && data?.ok===true && data?.purpose===expectedPurpose;
  }catch{
    return false;
  }
}

function cookie(req,name) {
  const raw=String(req.headers.cookie||"");
  for(const item of raw.split(";")) {
    const i=item.indexOf("=");
    if(i<0)continue;
    if(item.slice(0,i).trim()===name)return decodeURIComponent(item.slice(i+1).trim());
  }
  return "";
}

function ownerAuthorized(req) {
  const id=cookie(req,"hb_owner");
  if(!id)return false;
  const session=uiSessions.get(id);
  if(!session)return false;
  if(session.expiresAt<=Date.now()){
    uiSessions.delete(id);
    return false;
  }
  session.lastUsed=Date.now();
  return true;
}

async function remoteAuthorized(req) {
  const header=String(req.headers.authorization||"");
  const prefix="Bearer ";
  if(!header.startsWith(prefix))return false;
  return verifyBrokerToken(header.slice(prefix.length),"runtime");
}

async function claim(req,res) {
  const input=await readBody(req);
  const access=String(input?.access||"");
  if(!(await verifyBrokerToken(access,"owner"))) {
    return json(res,401,{ok:false,error:"owner_access_denied"});
  }
  const id=randomBytes(32).toString("base64url");
  uiSessions.set(id,{createdAt:Date.now(),lastUsed:Date.now(),expiresAt:Date.now()+30*24*60*60*1000});
  return json(res,200,{ok:true},{
    "set-cookie":`hb_owner=${encodeURIComponent(id)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`
  });
}

function clamp(v,min,max,fallback) {
  const n=Number(v);
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;
}

function privateIp(ip) {
  if(!ip)return true;
  if(net.isIP(ip)===4) {
    const p=ip.split(".").map(Number);
    return p[0]===0 || p[0]===10 || p[0]===127 ||
      (p[0]===169&&p[1]===254) ||
      (p[0]===172&&p[1]>=16&&p[1]<=31) ||
      (p[0]===192&&p[1]===168);
  }
  if(net.isIP(ip)===6) {
    const v=ip.toLowerCase();
    return v==="::" || v==="::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:");
  }
  return true;
}

async function publicHost(hostname) {
  const h=String(hostname||"").toLowerCase();
  if(!h || h.endsWith(".local") || h.endsWith(".internal"))return false;
  if(net.isIP(h))return !privateIp(h);
  const cached=dnsCache.get(h);
  if(cached&&cached.expires>Date.now())return cached.allowed;
  try {
    const rows=await dns.lookup(h,{all:true,verbatim:true});
    const allowed=rows.length>0&&rows.every(x=>!privateIp(x.address));
    dnsCache.set(h,{allowed,expires:Date.now()+DNS_CACHE_TTL});
    return allowed;
  } catch {
    dnsCache.set(h,{allowed:false,expires:Date.now()+5000});
    return false;
  }
}

async function safeUrl(raw) {
  if(typeof raw!=="string"||!raw||raw.length>2048)throw Error("invalid_target_url");
  const u=new URL(raw.includes("://")?raw:"https://"+raw);
  if(!["http:","https:"].includes(u.protocol))throw Error("unsupported_protocol");
  if(u.username||u.password)throw Error("embedded_credentials_blocked");
  if(!(await publicHost(u.hostname)))throw Error("private_target_blocked");
  return u.toString();
}

async function networkAllowed(raw) {
  try {
    const u=new URL(raw);
    if(["data:","blob:"].includes(u.protocol))return true;
    if(!["http:","https:"].includes(u.protocol))return false;
    return publicHost(u.hostname);
  } catch {
    return false;
  }
}

async function readBody(req) {
  const chunks=[];
  let total=0;
  for await(const c of req) {
    total+=c.length;
    if(total>MAX_BODY)throw Error("request_too_large");
    chunks.push(c);
  }
  if(!chunks.length)return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function browser() {
  if(browserPromise) {
    try {
      const b=await browserPromise;
      if(b.isConnected())return b;
    } catch {}
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
  try {
    const b=await browserPromise;
    b.on("disconnected",()=>{browserPromise=null;});
    return b;
  } catch(e) {
    browserPromise=null;
    throw e;
  }
}

async function freshSession() {
  const b=await browser();
  const context=await b.newContext({
    acceptDownloads:false,
    serviceWorkers:"block",
    viewport:VIEWPORT
  });
  const page=await context.newPage();
  await page.route("**/*",async route=>{
    if(await networkAllowed(route.request().url()))return route.continue();
    return route.abort("blockedbyclient");
  });
  const id=crypto.randomUUID();
  const s={id,context,page,lastUsed:Date.now(),createdAt:Date.now()};
  sessions.set(id,s);
  return s;
}

async function ownerSession() {
  if(ownerSessionId&&sessions.has(ownerSessionId)) {
    const s=sessions.get(ownerSessionId);
    s.lastUsed=Date.now();
    return s;
  }
  const s=await freshSession();
  ownerSessionId=s.id;
  return s;
}

async function closeSession(id) {
  const s=sessions.get(id);
  if(!s)return false;
  sessions.delete(id);
  if(ownerSessionId===id)ownerSessionId=null;
  await s.context.close().catch(()=>{});
  return true;
}

async function pageState(page) {
  return {
    title:await page.title().catch(()=>""),
    url:page.url(),
    viewport:VIEWPORT
  };
}

async function navigate(s,raw) {
  const target=await safeUrl(raw);
  await s.page.goto(target,{waitUntil:"domcontentloaded",timeout:MAX_TIMEOUT});
  s.lastUsed=Date.now();
  return pageState(s.page);
}

async function frame(s) {
  s.lastUsed=Date.now();
  return s.page.screenshot({type:"png",fullPage:false});
}

async function ownerControlledField(page,selector) {
  const info=await page.locator(selector).first().evaluate(el=>{
    const parts=[
      el.getAttribute?.("type"),
      el.getAttribute?.("name"),
      el.getAttribute?.("id"),
      el.getAttribute?.("autocomplete"),
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("placeholder"),
      el.textContent
    ].filter(Boolean);
    let label="";
    const id=el.getAttribute?.("id");
    if(id)label=document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent||"";
    return (parts.join(" ")+" "+label).toLowerCase();
  }).catch(()=>"");
  if(/password/.test(info))return "password";
  if(/one-time-code|\botp\b|verification code|security code/.test(info))return "one-time-code";
  if(/\bmfa\b|two[- ]factor|2fa/.test(info))return "mfa";
  if(/captcha|not a robot|human verification/.test(info))return "captcha";
  if(/accept.*terms|terms.*accept|agree.*terms|terms.*agree/.test(info))return "terms";
  if(/authorize|authorization|consent|allow access|grant access/.test(info))return "consent";
  return null;
}

function detectOwnerCheckpointText(text) {
  const t=String(text||"").toLowerCase();
  if(/captcha|verify you are human|not a robot/.test(t))return "captcha";
  if(/one-time code|verification code|two-factor|two factor|\bmfa\b/.test(t))return "mfa";
  if(/accept.*terms|agree.*terms/.test(t))return "terms";
  if(/authorize|allow access|grant access|consent/.test(t))return "consent";
  return null;
}

async function executeManualAction(s,input) {
  const type=String(input?.type||"");
  if(type==="click") {
    const x=clamp(input.x,0,VIEWPORT.width,0);
    const y=clamp(input.y,0,VIEWPORT.height,0);
    await s.page.mouse.click(x,y);
    s.lastUsed=Date.now();
    return {ok:true,type,x,y};
  }
  if(type==="text") {
    const value=String(input?.text||"").slice(0,4000);
    await s.page.keyboard.insertText(value);
    s.lastUsed=Date.now();
    return {ok:true,type,chars:value.length};
  }
  if(type==="key") {
    const key=String(input?.key||"");
    const allowed=new Set(["Tab","Enter","Escape","Backspace","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","PageUp","PageDown"]);
    if(!allowed.has(key))throw Error("key_blocked");
    await s.page.keyboard.press(key);
    s.lastUsed=Date.now();
    return {ok:true,type,key};
  }
  if(type==="scroll") {
    const deltaY=clamp(input?.deltaY,-1600,1600,0);
    await s.page.mouse.wheel(0,deltaY);
    s.lastUsed=Date.now();
    return {ok:true,type,deltaY};
  }
  if(type==="back") {
    await s.page.goBack({waitUntil:"domcontentloaded",timeout:15000}).catch(()=>null);
    return {ok:true,type,page:await pageState(s.page)};
  }
  if(type==="forward") {
    await s.page.goForward({waitUntil:"domcontentloaded",timeout:15000}).catch(()=>null);
    return {ok:true,type,page:await pageState(s.page)};
  }
  if(type==="reload") {
    await s.page.reload({waitUntil:"domcontentloaded",timeout:30000});
    return {ok:true,type,page:await pageState(s.page)};
  }
  throw Error("unsupported_action");
}

function makeResumeToken(intentId) {
  return intentId+"."+randomBytes(24).toString("base64url");
}

async function autopilotRun(s,input) {
  const intentId=String(input?.intentId||crypto.randomUUID());
  const resumeToken=String(input?.resumeToken||makeResumeToken(intentId));
  const steps=Array.isArray(input?.steps)?input.steps.slice(0,AUTOPILOT_MAX_STEPS):[];
  const state=autopilotIntents.get(intentId)||{
    intentId,resumeToken,status:"running",attempts:0,completedSteps:0,lastCheckpoint:null,createdAt:new Date().toISOString()
  };
  if(state.resumeToken!==resumeToken)throw Error("resume_token_invalid");
  state.attempts+=1;
  if(state.attempts>AUTOPILOT_MAX_RETRIES) {
    state.status="blocked";
    state.lastCheckpoint={kind:"retry_budget_exhausted",at:new Date().toISOString()};
    autopilotIntents.set(intentId,state);
    return state;
  }

  if(input?.url && state.completedSteps===0)await navigate(s,String(input.url));

  for(let i=state.completedSteps;i<steps.length;i++) {
    const step=steps[i]||{};
    const type=String(step.type||"");
    try {
      if(type==="navigate") {
        await navigate(s,String(step.url||""));
      } else if(type==="click") {
        const selector=String(step.selector||"").slice(0,500);
        if(!selector)throw Error("selector_required");
        const ownerReason=await ownerControlledField(s.page,selector);
        if(ownerReason) {
          state.status="owner_action_required";
          state.lastCheckpoint={kind:"owner_action_required",reason:ownerReason,step:i,at:new Date().toISOString()};
          autopilotIntents.set(intentId,state);
          return state;
        }
        await s.page.locator(selector).first().click({timeout:10000});
      } else if(type==="fill") {
        const selector=String(step.selector||"").slice(0,500);
        if(!selector)throw Error("selector_required");
        const ownerReason=await ownerControlledField(s.page,selector);
        if(ownerReason) {
          state.status="owner_action_required";
          state.lastCheckpoint={kind:"owner_action_required",reason:ownerReason,step:i,at:new Date().toISOString()};
          autopilotIntents.set(intentId,state);
          return state;
        }
        await s.page.locator(selector).first().fill(String(step.text||"").slice(0,4000),{timeout:10000});
      } else if(type==="press") {
        const selector=String(step.selector||"").slice(0,500);
        const key=String(step.key||"Enter").slice(0,40);
        if(selector)await s.page.locator(selector).first().press(key,{timeout:10000});
        else await s.page.keyboard.press(key);
      } else if(type==="wait") {
        await s.page.waitForTimeout(clamp(step.ms,0,5000,500));
      } else if(type==="scroll") {
        await s.page.mouse.wheel(0,clamp(step.deltaY,-1600,1600,600));
      } else {
        throw Error("unsupported_autopilot_step");
      }

      const visible=await s.page.locator("body").innerText({timeout:3000}).catch(()=>"");
      const checkpoint=detectOwnerCheckpointText(visible.slice(0,30000));
      if(checkpoint) {
        state.status="owner_action_required";
        state.lastCheckpoint={kind:"owner_action_required",reason:checkpoint,step:i,at:new Date().toISOString()};
        state.completedSteps=i+1;
        autopilotIntents.set(intentId,state);
        return state;
      }

      state.completedSteps=i+1;
      state.lastCheckpoint={kind:"step_complete",step:i,at:new Date().toISOString(),url:s.page.url()};
      s.lastUsed=Date.now();
    } catch(e) {
      state.status="retryable_failure";
      state.lastCheckpoint={kind:"execution_error",step:i,error:e instanceof Error?e.message:"autopilot_error",at:new Date().toISOString()};
      autopilotIntents.set(intentId,state);
      return state;
    }
  }

  state.status="completed";
  state.completedAt=new Date().toISOString();
  state.lastCheckpoint={kind:"completed",at:state.completedAt,url:s.page.url()};
  autopilotIntents.set(intentId,state);
  return state;
}

const mime = {
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".svg":"image/svg+xml; charset=utf-8"
};

async function staticFile(res,path) {
  let rel=path==="/"?"index.html":path.replace(/^\/+/, "");
  rel=normalize(rel).replace(/^\.\.(?:\/|\\|$)/g,"");
  const full=join(PUBLIC_DIR,rel);
  if(!full.startsWith(PUBLIC_DIR))return false;
  try {
    const data=await readFile(full);
    const ext=extname(full);
    res.writeHead(200,securityHeaders({
      "content-type":mime[ext]||"application/octet-stream",
      "cache-control":/icon-\d+\.svg$/.test(rel)?"public, max-age=86400":"no-cache"
    }));
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

setInterval(async()=>{
  const now=Date.now();
  const cutoff=now-SESSION_TTL;
  for(const [id,s] of sessions)if(s.lastUsed<cutoff)await closeSession(id);
  for(const [id,session] of uiSessions)if(session.expiresAt<=now)uiSessions.delete(id);
},60000).unref();

async function shutdown() {
  for(const id of [...sessions.keys()])await closeSession(id);
  if(browserPromise) {
    try {(await browserPromise).close();} catch {}
  }
  process.exit(0);
}
process.on("SIGTERM",shutdown);
process.on("SIGINT",shutdown);

http.createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");

  if(req.method==="GET"&&url.pathname==="/health") {
    return json(res,200,{
      ok:true,
      service:"hercules-browser-standalone",
      version:"1.0.0",
      engine:"playwright-local-chromium",
      pwa:true,
      autopilot:true,
      rawCodeExecution:false,
      antiBotBypass:false
    });
  }

  if(req.method==="POST"&&url.pathname==="/api/claim") {
    try{return await claim(req,res);}
    catch(e){
      const message=e instanceof Error?e.message:"owner_claim_failed";
      return json(res,400,{ok:false,error:message.slice(0,300)});
    }
  }

  if(
    url.pathname.startsWith("/api/") &&
    url.pathname!=="/api/claim" &&
    !ownerAuthorized(req) &&
    !(await remoteAuthorized(req))
  ) {
    return json(res,401,{ok:false,error:"browser_auth_required"});
  }

  try {
    if(req.method==="GET"&&url.pathname==="/api/status") {
      const s=await ownerSession();
      return json(res,200,{
        ok:true,
        authenticated:true,
        sessionId:s.id,
        page:await pageState(s.page),
        autopilot:{
          maxSteps:AUTOPILOT_MAX_STEPS,
          maxRetries:AUTOPILOT_MAX_RETRIES,
          intents:[...autopilotIntents.values()].slice(-10)
        }
      });
    }

    if(req.method==="POST"&&url.pathname==="/api/navigate") {
      const s=await ownerSession();
      const input=await readBody(req);
      return json(res,200,{ok:true,sessionId:s.id,page:await navigate(s,String(input.url||""))});
    }

    if(req.method==="GET"&&url.pathname==="/api/frame") {
      const s=await ownerSession();
      const png=await frame(s);
      res.writeHead(200,securityHeaders({"content-type":"image/png","content-length":String(png.length)}));
      return res.end(png);
    }

    if(req.method==="POST"&&url.pathname==="/api/action") {
      const s=await ownerSession();
      return json(res,200,await executeManualAction(s,await readBody(req)));
    }

    if(req.method==="POST"&&url.pathname==="/api/autopilot") {
      const s=await ownerSession();
      return json(res,200,{ok:true,sessionId:s.id,intent:await autopilotRun(s,await readBody(req))});
    }

    if(req.method==="POST"&&url.pathname==="/api/new-session") {
      if(ownerSessionId)await closeSession(ownerSessionId);
      const s=await ownerSession();
      return json(res,200,{ok:true,sessionId:s.id,page:await pageState(s.page)});
    }

    if(req.method==="GET"&&url.pathname.startsWith("/api/intent/")) {
      const id=decodeURIComponent(url.pathname.slice("/api/intent/".length));
      const state=autopilotIntents.get(id);
      return state?json(res,200,{ok:true,intent:state}):json(res,404,{ok:false,error:"intent_not_found"});
    }

    if(req.method==="GET"&&await staticFile(res,url.pathname))return;
    return json(res,404,{ok:false,error:"not_found"});
  } catch(e) {
    const message=e instanceof Error?e.message:"browser_error";
    const ownerBoundary=/owner_action_required|password|one-time-code|captcha|mfa|terms|consent/i.test(message);
    const clientError=[
      "invalid_target_url","unsupported_protocol","embedded_credentials_blocked",
      "private_target_blocked","request_too_large","key_blocked",
      "unsupported_action","unsupported_autopilot_step","selector_required","resume_token_invalid"
    ].includes(message);
    return json(res,ownerBoundary?409:(clientError?400:502),{ok:false,error:message.slice(0,500)});
  }
}).listen(PORT,"0.0.0.0");
