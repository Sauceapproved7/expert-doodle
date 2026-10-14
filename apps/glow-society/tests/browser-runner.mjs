import { createServer } from 'node:http';
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const preferred=process.env.CHROME_BIN;
const browsers=[preferred,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/opt/google/chrome/chrome'].filter(Boolean);
const browser=browsers.find(executable=>existsSync(executable));
if(!browser)throw Error('Chromium/Chrome is required for browser QA; no browser was found.');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server=createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
 const candidate=resolve(root,'.'+pathname);
 if(!(candidate===root || candidate.startsWith(root+sep))){res.writeHead(403);res.end();return}
 try{
  const file=readFileSync(candidate);
  res.writeHead(200,{'Content-Type':mime[extname(candidate)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(file);
 }catch{res.writeHead(404);res.end('Not found')}
});
const profile=mkdtempSync(join(tmpdir(),'glow-qa-'));
let child;
try{
 await new Promise((done,fail)=>{server.listen(0,'127.0.0.1',done);server.on('error',fail)});
 const url='http://127.0.0.1:'+server.address().port+'/tests/browser.html';
 const args=['--headless=new','--disable-gpu','--disable-dev-shm-usage','--no-sandbox','--no-first-run','--no-default-browser-check',
  '--disable-extensions','--disable-background-networking','--no-proxy-server',
  '--window-size=390,844',
  '--virtual-time-budget=9000','--user-data-dir='+profile,'--dump-dom',url];
 const result=await new Promise((done,fail)=>{
  let stdout='',stderr='';
  child=spawn(browser,args,{stdio:['ignore','pipe','pipe']});
  const killer=setTimeout(()=>{child.kill('SIGKILL');fail(Error('Browser QA timed out after 35 seconds'));},35000);
  child.stdout.on('data',b=>stdout+=b.toString());
  child.stderr.on('data',b=>stderr+=b.toString());
  child.on('error',err=>{clearTimeout(killer);fail(err)});
  child.on('close',code=>{clearTimeout(killer);done({code,stdout,stderr})});
 });
 const html=result.stdout;
 const status=html.match(/<pre[^>]*id="result"[^>]*data-status="(pass|fail|running)"/)?.[1];
 assert.equal(status,'pass','Browser tests did not pass: '+(html.match(/<pre[^>]*id="result"[^>]*>([\s\S]*?)<\/pre>/)?.[1]||result.stderr).slice(-6000));
 const count=(html.match(/PASS /g)||[]).length;
 assert.ok(count>=15,'Unexpectedly few browser checks: '+count);
 console.log('Glow Society Chromium DOM tests passed ('+count+' checks).');
}finally{
 if(child&&!child.killed&&child.exitCode===null)child.kill('SIGKILL');
 await new Promise(done=>server.close(done));
 try{rmSync(profile,{recursive:true,force:true})}catch{}
}