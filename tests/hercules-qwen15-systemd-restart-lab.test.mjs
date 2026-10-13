// First-party contract for a *temporary* Linux systemd restart drill.
// Never provisions a VM or launches Hercules/Qwen publicly.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const unit=readFileSync(new URL("../deploy/hercules-qwen15/hercules-qwen15-private.service",import.meta.url),"utf8");
const workflowUrl=new URL("../.github/workflows/hercules-qwen15-systemd-restart-lab.yml",import.meta.url);
const docUrl=new URL("../docs/HERCULES-QWEN15-SYSTEMD-RESTART-LAB.md",import.meta.url);
const workflow=()=>readFileSync(workflowUrl,"utf8");

test("the owner-private service has a bounded on-failure restart policy",()=>{
  for(const rule of ["Restart=on-failure","RestartSec=30s","StartLimitIntervalSec=5min",
    "StartLimitBurst=3","KillMode=control-group","LimitCORE=0",
    "ConditionPathExists=/etc/hercules/qwen15-private.approved"]){
    assert.ok(unit.includes("\n"+rule+"\n"),rule);
  }
  assert.ok(unit.includes("ExecStart=/usr/bin/node /opt/hercules/current/scripts/hercules-qwen15-owner-host.mjs"));
});
test("ephemeral systemd drill reads all real restart limits, not duplicate guessed values",()=>{
  const ci=workflow();
  for(const directive of ["Restart","RestartSec","StartLimitIntervalSec","StartLimitBurst","KillMode"]){
    assert.ok(ci.includes('read_setting '+directive),directive);
  }
  assert.match(ci,/systemd-run/);
  assert.match(ci,/--property="Restart=\$restart"/);
  assert.match(ci,/--property="RestartSec=\$restart_sec"/);
  assert.match(ci,/--property="StartLimitIntervalSec=\$interval"/);
  assert.match(ci,/--property="StartLimitBurst=\$burst"/);
  assert.match(ci,/--property="KillMode=\$kill_mode"/);
});
test("drill proves failure, real restart attempts and final start-limit-hit",()=>{
  const ci=workflow();
  assert.match(ci,/sudo systemctl show/);
  assert.match(ci,/Result/);
  assert.match(ci,/NRestarts/);
  assert.match(ci,/start-limit-hit/);
  assert.match(ci,/restart_count/);
  assert.match(ci,/test "\$restart_count" -ge 2/);
  assert.match(ci,/test "\$restart_count" -le 3/);
  assert.match(ci,/systemd_recovery_burst_verified/);
});
test("transient test is non-privileged, isolated, never deploys or starts owner unit",()=>{
  const ci=workflow();
  assert.match(ci,/User=nobody/);
  assert.match(ci,/\/usr\/bin\/false/);
  assert.match(ci,/GITHUB_RUN_ID/);
  assert.match(ci,/GITHUB_RUN_ATTEMPT/);
  assert.match(ci,/trap .*cleanup/);
  assert.doesNotMatch(ci,/systemctl enable|systemctl start|systemctl restart|render\.com|railway\.app|devbrain|ai_ok\s*=\s*true|SHOPIFY_API_KEY|OPENAI_API_KEY/);
  assert.doesNotMatch(ci,/HERCULES_MODEL_TOKEN|QWEN15_PRIVATE_TRIAL|\.gguf|\/v1\/chat/);
});
test("drill documentation preserves real-host and billing boundaries",()=>{
  const doc=readFileSync(docUrl,"utf8");
  for(const term of ["ephemeral GitHub","not a permanent host","not real model inference",
    "no paid hosting","owner authorization","production main","Devbrain"]){
    assert.ok(doc.toLowerCase().includes(term.toLowerCase()),term);
  }
});
