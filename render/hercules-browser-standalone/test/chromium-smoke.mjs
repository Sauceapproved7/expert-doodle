import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {extname,join} from "node:path";
import {chromium} from "playwright-core";

const PUBLIC=fileURLToPath(new URL("../public/",import.meta.url));
const allowed=new Set(["/","/sw.js","/app.js","/search-intent.mjs","/style.css","/manifest.webmanifest","/icon-192.svg","/icon-512.svg"]);
const mime={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css",".webmanifest":"application/manifest+json",".svg":"image/svg+xml"};
const json=(res,status,data,headers={})=>{res.writeHead(status,{"content-type":"application/json","cache-control":"no-store",...headers});res.end(JSON.stringify(data))};

test("real Chromium: owner lock, search UI, mobile, and offline-cache boundaries", {timeout:90000}, async()=>{
  assert.ok(process.env.CHROME_PATH,"CHROME_PATH must specify Chromium executable; do not silently skip release gate");
  let lastNavigate="";
  const server=http.createServer(async(req,res)=>{
    const path=new URL(req.url,"http://127.0.0.1").pathname;
    const authorized=(req.headers.cookie||"").includes("hb_owner=fixture");
    if(path==="/api/status")return authorized?json(res,200,{ok:true,page:{url:"about:blank",title:""},autopilot:{maxSteps:25,maxRetries:3}}):json(res,401,{ok:false,error:"browser_auth_required"});
    if(path==="/api/navigate"&&req.method==="POST"){
      if(!authorized)return json(res,401,{ok:false,error:"browser_auth_required"});
      let body="";for await(const b of req)body+=b;
      lastNavigate=JSON.parse(body).url;
      return json(res,200,{ok:true,page:{url:lastNavigate,title:"Local fixture"}});
    }
    if(path.startsWith("/api/"))return json(res,authorized?404:401,{ok:false,error:authorized?"fixture_no_frame":"browser_auth_required"});
    if(!allowed.has(path)){res.writeHead(404);return res.end("Not found")}
    const file=path==="/"?"/index.html":path;
    try {
      const body=await readFile(join(PUBLIC,file));
      res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-cache"});
      res.end(body);
    }catch {res.writeHead(404);res.end("Missing fixture")}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try{
    const origin="http://127.0.0.1:"+server.address().port;
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:["--no-sandbox","--disable-dev-shm-usage"]});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"allow"});
    const page=await context.newPage();
    await page.goto(origin,{waitUntil:"load"});
    await page.waitForFunction(()=>document.getElementById("healthText")?.textContent==="Auth required");
    assert.equal(lastNavigate,"");
    await context.addCookies([{name:"hb_owner",value:"fixture",url:origin,httpOnly:true,sameSite:"Strict"}]);
    await page.reload({waitUntil:"load"});
    await page.waitForFunction(()=>document.getElementById("sessionState")?.textContent==="Connected");
    await page.locator("#searchProvider").selectOption("duckduckgo");
    await page.locator("#urlInput").fill("wholesale hoodie suppliers");
    await page.locator("#navForm button[type=submit]").click();
    await page.waitForFunction(()=>document.getElementById("pageUrl")?.textContent.startsWith("https://duckduckgo.com/?q="));
    assert.equal(lastNavigate,"https://duckduckgo.com/?q=wholesale%20hoodie%20suppliers");
    const width=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(width.page<=width.viewport+2,"mobile layout must not overflow horizontally");
    const installed=await page.evaluate(async()=>{
      await navigator.serviceWorker.ready;
      const names=await caches.keys();
      const paths=[];
      for(const name of names){const cache=await caches.open(name);for(const r of await cache.keys())paths.push(new URL(r.url).pathname)}
      return {names,paths};
    });
    assert.ok(installed.names.some(x=>x.includes("hercules-browser-shell-v6")));
    assert.ok(installed.paths.includes("/app.js"));
    assert.ok(installed.paths.includes("/search-intent.mjs"));
    assert.ok(!installed.paths.includes("/") && installed.paths.every(x=>!x.startsWith("/api/")));
    await context.setOffline(true);
    const checks=await page.evaluate(async()=>{
      const result={};
      try {const r=await fetch("/style.css",{credentials:"omit"});result.shellStatus=r.status}catch{result.shellStatus="failed"}
      try {await fetch("/style.css",{credentials:"same-origin"});result.defaultMode="unexpected_cached"}catch{result.defaultMode="network_blocked"}
      try {await fetch("/api/status");result.api="unexpected_cached"}catch{result.api="network_blocked"}
      return result;
    });
    assert.equal(checks.shellStatus,200);
    assert.equal(checks.defaultMode,"network_blocked");
    assert.equal(checks.api,"network_blocked");
    await context.close();
  } finally {
    await browser?.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
