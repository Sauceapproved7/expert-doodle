import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import http from "node:http";

import {createDefaultProfiles} from "../hercules-cleaner/defaults.mjs";
import {cleanComputer, startWorkSession, stopWorkSession, setProfileSchedule} from "../hercules-cleaner/agent.mjs";
import {createAutostartPlan} from "../hercules-cleaner/autostart.mjs";
import {createCleanerServer} from "../hercules-cleaner/server.mjs";
import {loadConfig, saveConfig} from "../hercules-cleaner/state.mjs";

async function tempRoot() { return mkdtemp(join(tmpdir(), "hercules-cleaner-agent-")); }

function request({port, path="/", method="GET", token, origin, body}) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request({
      hostname:"127.0.0.1",
      port,
      path,
      method,
      headers:{
        ...(token?{"x-hercules-token":token}:{}),
        ...(origin?{origin}:{}),
        ...(payload?{"content-type":"application/json","content-length":payload.length}:{}),
      },
    }, (res) => {
      const chunks=[];
      res.on("data",(c)=>chunks.push(c));
      res.on("end",()=>resolve({status:res.statusCode, body:Buffer.concat(chunks).toString("utf8")}));
    });
    req.on("error",reject);
    if(payload) req.write(payload);
    req.end();
  });
}

test("default profiles keep personal document folders protected and support session/low-storage modes", () => {
  const home = "/home/tester";
  const profiles = createDefaultProfiles({platform:"linux", home, temp:"/tmp/hc", env:{XDG_CACHE_HOME:"/home/tester/.cache"}});
  assert.equal(profiles.some((p)=>p.schedule.type==="afterSession"), true);
  assert.equal(profiles.some((p)=>p.schedule.type==="lowStorage"), true);
  assert.equal(profiles.every((p)=>p.protectedPaths.includes("/home/tester/Documents")), true);
});

test("Windows defaults include browser cache locations inside approved scan roots", () => {
  const profiles = createDefaultProfiles({
    platform:"win32",
    home:"C:\\Users\\Test",
    temp:"C:\\Users\\Test\\AppData\\Local\\Temp",
    env:{LOCALAPPDATA:"C:\\Users\\Test\\AppData\\Local"},
  });
  const quick=profiles.find((p)=>p.id==="quick-safe");
  const chrome=quick.cleanAllInRoots.find((path)=>path.includes("Google"));
  assert.ok(chrome);
  assert.equal(quick.roots.includes(chrome), true);
});

test("agent clean routes disposable files through the recovery vault", async () => {
  const root = await tempRoot();
  const cache = join(root,"cache");
  await mkdir(cache,{recursive:true});
  await writeFile(join(cache,"old.tmp"),"junk");
  const stateRoot=join(root,"state");
  const config = await loadConfig({home:root,stateRoot});
  config.activeProfileId="test";
  config.profiles=[{id:"test",name:"Test",roots:[cache],cleanAllInRoots:[],protectedPaths:[],disposableExtensions:[".tmp"],minAgeMs:0,maxFiles:100,maxDepth:5,recoveryRetentionMs:86400000,schedule:{type:"weekly",enabled:true}}];
  await saveConfig(config,{home:root,stateRoot});
  const result=await cleanComputer({home:root,stateRoot});
  assert.equal(result.cleanedFiles,1);
  assert.equal(await readFile(join(stateRoot,"recovery-vault",result.capsule.id,"manifest.json"),"utf8").then(x=>JSON.parse(x).state),"sealed");
  await rm(root,{recursive:true,force:true});
});

test("Session Clean cleans only disposable artifacts created during the tracked session", async () => {
  const root=await tempRoot();
  const cache=join(root,"cache");
  await mkdir(cache,{recursive:true});
  await writeFile(join(cache,"before.tmp"),"old");
  const stateRoot=join(root,"state");
  const config=await loadConfig({home:root,stateRoot});
  config.profiles=[{id:"after-work",name:"After Work",roots:[cache],cleanAllInRoots:[],protectedPaths:[],disposableExtensions:[".tmp"],minAgeMs:0,maxFiles:100,maxDepth:5,recoveryRetentionMs:86400000,schedule:{type:"afterSession",enabled:true}}];
  config.activeProfileId="after-work";
  await saveConfig(config,{home:root,stateRoot});
  const session=await startWorkSession({home:root,stateRoot,profileId:"after-work"});
  await new Promise(r=>setTimeout(r,10));
  await writeFile(join(cache,"during.tmp"),"new");
  const result=await stopWorkSession({home:root,stateRoot,sessionId:session.id,apply:true});
  assert.deepEqual(result.plan.candidates.map(x=>x.path),[join(cache,"during.tmp")]);
  assert.equal(await readFile(join(cache,"before.tmp"),"utf8"),"old");
  await rm(root,{recursive:true,force:true});
});

test("dashboard is loopback-only and blocks unauthenticated or cross-origin control calls", async () => {
  assert.throws(()=>createCleanerServer({host:"0.0.0.0"}),/loopback only/);
  const root=await tempRoot();
  const instance=createCleanerServer({host:"127.0.0.1",port:0,home:root,stateRoot:join(root,"state"),token:"test-token"});
  await new Promise((resolve,reject)=>{
    instance.server.once("error",reject);
    instance.server.listen(0,"127.0.0.1",resolve);
  });
  const port=instance.server.address().port;
  const denied=await request({port,path:"/api/status"});
  assert.equal(denied.status,401);
  const cross=await request({port,path:"/api/status",token:"test-token",origin:"https://evil.example"});
  assert.equal(cross.status,403);
  const allowed=await request({port,path:"/api/status",token:"test-token"});
  assert.equal(allowed.status,200);
  await new Promise((resolve)=>instance.server.close(resolve));
  await rm(root,{recursive:true,force:true});
});

test("native autostart plans use user-scoped OS facilities", () => {
  const win=createAutostartPlan({platform:"win32",home:"C:\\Users\\Test",nodePath:"C:\\node.exe",cliPath:"C:\\hc\\cli.mjs"});
  assert.equal(win.kind,"windows-scheduled-task");
  assert.equal(win.install.args.includes("ONLOGON"),true);
  const mac=createAutostartPlan({platform:"darwin",home:"/Users/test",nodePath:"/usr/local/bin/node",cliPath:"/opt/hc/cli.mjs"});
  assert.equal(mac.file.path.endsWith("com.sauceapproved.hercules-cleaner.plist"),true);
  const linux=createAutostartPlan({platform:"linux",home:"/home/test",nodePath:"/usr/bin/node",cliPath:"/opt/hc/cli.mjs"});
  assert.match(linux.file.content,/NoNewPrivileges=true/);
  assert.match(linux.file.content,/ProtectSystem=strict/);
  assert.match(linux.file.content,/ProtectHome=false/);
});

test("schedule configuration supports every-other-day automation without changing protected cleanup rules", async () => {
  const root=await tempRoot();
  const stateRoot=join(root,"state");
  const config=await loadConfig({home:root,stateRoot});
  config.profiles=[{...config.profiles[0],id:"quick-safe",roots:[join(root,"cache")]}];
  config.activeProfileId="quick-safe";
  await saveConfig(config,{home:root,stateRoot});
  const updated=await setProfileSchedule({home:root,stateRoot,profileId:"quick-safe",schedule:{type:"everyNDays",days:2,enabled:true}});
  assert.deepEqual(updated.schedule,{type:"everyNDays",days:2,enabled:true});
  const reloaded=await loadConfig({home:root,stateRoot});
  assert.equal(reloaded.profiles[0].protectedPaths.length>0,true);
  await rm(root,{recursive:true,force:true});
});
