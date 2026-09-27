import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const launch=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");

test("authenticated Hercules app exposes Domain Agent navigation and workspace",()=>{
  assert.match(launch,/data-view="domainAgentView"[^>]*>Domain Agent</);
  assert.match(launch,/id="domainAgentView"/);
  assert.match(launch,/id="domainAgentSummary"/);
  assert.match(launch,/id="domainAgentIdentity"/);
  assert.match(launch,/id="domainAgentProviders"/);
  assert.match(launch,/id="domainAgentExecution"/);
});

test("Domain Agent workspace loads live usage identity and provider grant state",()=>{
  assert.match(launch,/domain_agent_usage_status/);
  assert.match(launch,/domain_agent_identity_status/);
  assert.match(launch,/domain_agent_grant_status/);
  assert.match(launch,/loadDomainAgent/);
  assert.match(launch,/domainAgentProvider/);
  assert.match(launch,/domainAgentAccountKey/);
});

test("Domain Agent workspace can run a safe Hercules-owned self-test",()=>{
  assert.match(launch,/domain_agent_execute/);
  assert.match(launch,/runtime\.selftest/);
  assert.match(launch,/domainAgentSelfTest/);
  assert.match(launch,/execution_performed/);
});

test("Domain Agent API-key controls are owner-driven and secret is shown only from the issue response",()=>{
  assert.match(launch,/domain_agent_api_key_issue/);
  assert.match(launch,/domain_agent_api_key_revoke/);
  assert.match(launch,/domainAgentIssueKey/);
  assert.match(launch,/domainAgentRevokeKey/);
  assert.match(launch,/api_key_secret/);
  assert.doesNotMatch(launch,/hda_live_[0-9a-f]{20,}/i);
});

test("Domain Agent navigation loads its live state on selection",()=>{
  assert.match(launch,/b\.dataset\.view==="domainAgentView"\)await loadDomainAgent\(\)/);
});

test("Hercules app health advertises the embedded Domain Agent control surface",()=>{
  assert.match(launch,/domain_agent:true/);
  assert.match(launch,/version:"1\.8\.0"/);
});
