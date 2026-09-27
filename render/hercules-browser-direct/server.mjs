import http from "node:http";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { chromium } from "playwright-core";

const PORT=Number(process.env.PORT||10000);
const TOKEN=process.env.HERCULES_DIRECT_TOKEN||"";
const MAX_BODY=262144;
const MAX_STEPS=25;
const MAX_TIMEOUT=60000;
const SESSION_TTL=10*60*1000;
const DNS_TTL=60*1000;
const sessions=new Map();
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
    ignoreHTTPSErrors:false
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
},60000).unref();

http.createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");

  if(req.method==="GET"&&url.pathname==="/health"){
    return reply(res,200,{
      ok:true,
      service:"hercules-browser-direct",
      engine:"playwright-direct-chromium",
      actions:["navigate","scrape","screenshot","interact","close_session"],
      sessionReuse:true,
      rawCodeExecution:false,
      antiBotBypass:false
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
