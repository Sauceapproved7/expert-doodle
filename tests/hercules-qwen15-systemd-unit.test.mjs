import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const unitUrl=new URL("../deploy/hercules-qwen15/hercules-qwen15-private.service",import.meta.url);
const parse=(text)=>{
  const sections=new Map();let current=null;
  for(const source of text.split(/\r?\n/)){
    const line=source.trim();
    if(!line||line.startsWith("#")||line.startsWith(";"))continue;
    if(/^\[[A-Za-z]+\]$/.test(line)){
      current=line.slice(1,-1);if(sections.has(current))throw Error("duplicate section");
      sections.set(current,new Map());continue;
    }
    if(!current||!line.includes("="))throw Error("invalid service unit entry");
    const i=line.indexOf("="),key=line.slice(0,i),value=line.slice(i+1);
    if(sections.get(current).has(key))throw Error("duplicate service setting: "+key);
    sections.get(current).set(key,value);
  }
  return Object.fromEntries([...sections].map(([k,v])=>[k,Object.fromEntries(v)]));
};
const unit=()=>readFileSync(unitUrl,"utf8");

test("private launcher service is inert without explicit owner acceptance and credential file",()=>{
  const c=parse(unit());
  assert.equal(c.Unit.ConditionPathExists,"/etc/hercules/qwen15-private.approved");
  assert.equal(c.Service.EnvironmentFile,"/etc/hercules/qwen15-private.env");
  assert.equal(c.Service.ExecStart,"/usr/bin/node /opt/hercules/current/scripts/hercules-qwen15-owner-host.mjs");
  assert.equal(c.Service.WorkingDirectory,"/opt/hercules/current");
  assert.equal(c.Service.Type,"simple");
  assert.equal(c.Service.User,"hercules-ai");
  assert.equal(c.Service.Group,"hercules-ai");
  assert.equal(c.Install.WantedBy,"multi-user.target");
  assert.equal(c.Service.UMask,"0077");
  assert.doesNotMatch(unit(),/HERCULES_MODEL_TOKEN\s*=|HERCULES_QWEN15_PRIVATE_TRIAL\s*=\s*true/);
  assert.ok(!("ExecStartPre" in c.Service));
  assert.ok(!("ExecStartPost" in c.Service));
});
test("server supervision is failure-only with bounded recovery and no process orphaning",()=>{
  const c=parse(unit());
  assert.equal(c.Service.Restart,"on-failure");
  assert.equal(c.Service.RestartSec,"30s");
  assert.equal(c.Unit.StartLimitIntervalSec,"5min");
  assert.equal(c.Unit.StartLimitBurst,"3");
  assert.equal(c.Service.TimeoutStopSec,"15s");
  assert.equal(c.Service.KillMode,"control-group");
  assert.equal(c.Service.LimitCORE,"0");
  assert.equal(c.Service.StandardOutput,"journal");
  assert.equal(c.Service.StandardError,"journal");
});
test("service process is non-root, filesystem protected and network restricted to localhost",()=>{
  const c=parse(unit());
  for(const [key,value] of Object.entries({
    NoNewPrivileges:"yes",ProtectSystem:"strict",ProtectHome:"yes",
    PrivateTmp:"yes",PrivateDevices:"yes",ProtectKernelTunables:"yes",
    ProtectKernelModules:"yes",ProtectControlGroups:"yes",
    RestrictSUIDSGID:"yes",IPAddressDeny:"any",
    IPAddressAllow:"localhost",RestrictAddressFamilies:"AF_UNIX AF_INET AF_INET6",
    LockPersonality:"yes"
  }))assert.equal(c.Service[key],value,key);
  assert.doesNotMatch(unit(),/0\.0\.0\.0|https?:\/\/|\/bin\/(?:bash|sh)|User\s*=\s*root/);
  assert.ok(!("AmbientCapabilities" in c.Service));
});
test("systemd memory and CPU limits agree with private-host preflight and never claim production",()=>{
  const c=parse(unit());
  assert.equal(c.Service.MemoryAccounting,"yes");
  assert.equal(c.Service.CPUAccounting,"yes");
  assert.equal(c.Service.MemoryMax,"4G");
  assert.equal(c.Service.CPUQuota,"200%");
  assert.equal(c.Service.TasksMax,"64");
  assert.equal(c.Service.MemorySwapMax,"0");
  assert.doesNotMatch(unit(),/ai_ok|productionInferenceVerified|publicReleaseApproved|APPROVED_FOR_PRODUCTION|Shopify|Stripe/i);
});
test("host operators are told exactly what remains outside this inert service definition",()=>{
  const doc=readFileSync(new URL("../docs/HERCULES-QWEN15-PRIVATE-SYSTEMD.md",import.meta.url),"utf8");
  for(const marker of [
    "No VM was provisioned", "owner-approved", "4 GiB",
    "independent cost verification","never place secrets in Git",
    "devbrain", "systemctl", "not proof of production"
  ])assert.ok(doc.toLowerCase().includes(marker.toLowerCase()),marker);
});

test("CI verifies real systemd parser without enabling or starting services",()=>{
  const ci=readFileSync(new URL("../.github/workflows/hercules-qwen15-private-systemd.yml",import.meta.url),"utf8");
  assert.match(ci,/systemd-analyze verify/);
  assert.match(ci,/mktemp -d/);
  assert.match(ci,/ExecStart=\/usr\/bin\/true/);
  assert.match(ci,/hercules-qwen15-private\.service/);
  assert.doesNotMatch(ci,/\bsystemctl\s+(?:enable|start|restart|daemon-reload)\b/);
  assert.match(ci,/node --test tests\/hercules-qwen15-systemd-unit\.test\.mjs/);
});
test("native real-model CI drills owner-host stop and verifies all loopback ports close",()=>{
  const ci=readFileSync(new URL("../.github/workflows/hercules-arm64-qwen15-comparison.yml",import.meta.url),"utf8");
  assert.match(ci,/kill -TERM "\$private_pid"/);
  assert.match(ci,/private_shutdown_verified/);
  assert.match(ci,/127\.0\.0\.1:38900\/health/);
  assert.match(ci,/127\.0\.0\.1:18776\/health/);
  assert.match(ci,/wait "\$private_pid"/);
  assert.doesNotMatch(ci,/\bsystemctl\s+(?:enable|start)\b/);
});

test("native ARM64 run must prove a model-child crash fails the private wrapper closed",()=>{
  const ci=readFileSync(new URL("../.github/workflows/hercules-arm64-qwen15-comparison.yml",import.meta.url),"utf8");
  for(const token of [
    'crash_parent_pid=$!',
    '/proc/$crash_parent_pid/task/$crash_parent_pid/children',
    'kill -KILL "$model_child_pid"',
    'wait "$crash_parent_pid"',
    'private_child_crash_failclosed_verified',
    'http://127.0.0.1:38900/health',
    'http://127.0.0.1:18776/health',
    'test "$crash_exit_code" -ne 0'
  ])assert.ok(ci.includes(token),token);
  assert.doesNotMatch(ci,/systemctl\s+(enable|start|restart)/);
  assert.doesNotMatch(ci,/ai_ok\s*=\s*true|RENDER_API_KEY|SHOPIFY_API_KEY/);
});
test("private owner-host source terminates abnormally on unexpected model exit",()=>{
  const source=readFileSync(new URL("../scripts/hercules-qwen15-owner-host.mjs",import.meta.url),"utf8");
  assert.match(source,/server\.once\("exit"/);
  assert.match(source,/process\.exit\(1\)/);
  assert.match(source,/listenModelPlaneService/);
  assert.doesNotMatch(source,/process\.exit\(0\).*(?:server|child).*error/i);
});

test("ARM64 live engine workflow invokes a real systemd Qwen recovery probe",()=>{
  const ci=readFileSync(new URL("../.github/workflows/hercules-arm64-qwen15-comparison.yml",import.meta.url),"utf8");
  assert.match(ci,/name: Prove owner-private Qwen itself restarts under native systemd/);
  assert.match(ci,/bash scripts\/hercules-qwen15-native-systemd-probe\.sh/);
  assert.doesNotMatch(ci,/systemctl (?:enable|preset) /);
});
test("real systemd probe uses isolated owner-gated unit without billing, public traffic or fixed secrets",()=>{
  const script=readFileSync(new URL("../scripts/hercules-qwen15-native-systemd-probe.sh",import.meta.url),"utf8");
  for(const marker of [
    "systemctl daemon-reload","systemctl start","systemctl stop",
    "systemctl show","RestartSec=30s","HERCULES_MODEL_TOKEN",
    "HERCULES_QWEN15_PRIVATE_TRIAL=true","ConditionPathExists=",
    "MemoryMax=4G","CPUQuota=200%","User=nobody",
    "http://127.0.0.1:38900/health","http://127.0.0.1:18776/health",
    "node scripts/hercules-qwen15-private-live-smoke.mjs",
    "systemd_real_qwen_recovery_verified"
  ])assert.ok(script.includes(marker),marker);
  assert.match(script,/kill -KILL "\$model_child_pid"/);
  assert.match(script,/sudo journalctl -u/);
  assert.match(script,/trap .*cleanup/);
  assert.doesNotMatch(script,/https?:\/\/(?!127\.0\.0\.1)|systemctl enable|systemctl preset|ai_ok\s*=\s*true|RENDER_API_KEY|SHOPIFY_API_KEY|railway\.app/);
});
test("real model unit is copied rather than relaxing original security policy",()=>{
  const script=readFileSync(new URL("../scripts/hercules-qwen15-native-systemd-probe.sh",import.meta.url),"utf8");
  assert.match(script,/deploy\/hercules-qwen15\/hercules-qwen15-private\.service/);
  assert.match(script,/ProtectHome=yes/);
  assert.match(script,/PrivateTmp=yes/);
  assert.match(script,/IPAddressDeny=any/);
  assert.match(script,/IPAddressAllow=localhost/);
  assert.match(script,/BindReadOnlyPaths=/);
  assert.match(script,/rm -f/);
});
test("lab documents no live host, no billing and limited recovery proof",()=>{
  const doc=readFileSync(new URL("../docs/HERCULES-QWEN15-REAL-SYSTEMD-CI.md",import.meta.url),"utf8");
  for(const term of ["ephemeral","not a production host","no extra hosting",
    "owner authorization","Devbrain","actual Qwen","bounded restart",
    "production main"])
    assert.ok(doc.toLowerCase().includes(term.toLowerCase()),term);
});

test("real model systemd CI explicitly declares the approved external-command boundary",()=>{
  const policy=JSON.parse(readFileSync(new URL("../governance/owner-code-policy.json",import.meta.url),"utf8"));
  const binding=policy.shellCommandBoundaries.find(x=>x.path==="scripts/hercules-qwen15-native-systemd-probe.sh");
  assert.deepEqual(binding?.dependencies,["posix-shell","nodejs","systemd","llama-cpp"]);
  for(const dependency of binding.dependencies)
    assert.equal(policy.externalInfrastructure.find(x=>x.id===dependency)?.packagedAsHerculesCode,false);
});
