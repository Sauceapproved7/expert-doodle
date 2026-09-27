import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const agent=await readFile(new URL("../supabase/functions/hercules-private-bridge/domain-agent.ts",import.meta.url),"utf8");

test("private bridge multiplexes Hercules Domain Agent before generic routes",()=>{
  assert.match(bridge,/handleDomainAgentRequest/);
  assert.match(bridge,/isDomainAgentAction/);
  assert.match(bridge,/isDomainAgentGet/);
  assert.match(bridge,/if\(isDomainAgentGet\(req,requestUrl\)\)return handleDomainAgentRequest\(req\)/);
  assert.match(bridge,/if\(isDomainAgentAction\(probeAction\)\)return handleDomainAgentRequest\(req\)/);
});

test("domain agent reuses production grant and audit RPCs without decrypting secrets",()=>{
  assert.match(agent,/hercules_domain_agent_resolve_provider_grant/);
  assert.match(agent,/hercules_domain_agent_record_audit/);
  assert.doesNotMatch(agent,/hercules_get_secret/);
  assert.doesNotMatch(agent,/access_secret_ref|secret_ref|signing_secret_ref/);
});

test("domain agent accepts only owner-admin or Hercules internal authorization for POST",()=>{
  assert.match(agent,/ownerOrAdmin/);
  assert.match(agent,/internalAuthorized/);
  assert.match(agent,/domain-agent-control/);
  assert.match(agent,/x-hercules-internal-key/);
  assert.match(agent,/owner_admin_or_internal_authorization_required/);
});

test("public discovery is honest about multiplex deployment and execution state",()=>{
  assert.match(agent,/hercules\.domain-agent\.discovery\.v1/);
  assert.match(agent,/agent\.sauceapproved\.com/);
  assert.match(agent,/hercules-private-bridge/);
  assert.match(agent,/automaticRefresh:false/);
  assert.match(agent,/refreshMetadata:true/);
  assert.match(agent,/executionAdapters:false/);
  assert.match(agent,/customDomainVerified:false/);
});

test("owner-only boundaries fail closed before provider grant resolution",()=>{
  assert.match(agent,/OWNER_ONLY/);
  assert.match(agent,/required_permission_grants/);
  assert.match(agent,/private_credentials_or_2fa/);
  assert.match(agent,/legally_binding_consent/);
  const boundary=agent.indexOf("body.owner_boundary");
  const resolve=agent.indexOf("resolveGrant(principal.organizationId,body)");
  assert.ok(boundary>=0 && resolve>boundary);
});

test("domain agent bounds request size and returns no-store security headers",()=>{
  assert.match(agent,/MAX_BODY_BYTES/);
  assert.match(agent,/request_body_too_large/);
  assert.match(agent,/'cache-control':'no-store'/i);
  assert.match(agent,/'x-content-type-options':'nosniff'/i);
});

test("generic private bridge advertises domain-agent capability after multiplexing",()=>{
  assert.match(bridge,/domain_agent_authorization/);
  assert.match(bridge,/domain_agent_preflight/);
  assert.match(bridge,/domain_agent_discovery/);
});
