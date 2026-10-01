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

test("domain agent reuses production grant and audit RPCs without taking provider credential custody",()=>{
  assert.match(agent,/hercules_domain_agent_resolve_provider_grant/);
  assert.match(agent,/hercules_domain_agent_record_audit/);
  assert.match(agent,/hercules_internal_service_keys/);
  assert.match(agent,/hercules_get_secret/);
  assert.doesNotMatch(agent,/hercules_provider_connections/);
  assert.doesNotMatch(agent,/access_secret_ref|signing_secret_ref/);
  assert.doesNotMatch(agent,/x-shopify-access-token|api\.stripe\.com|oauth2\.googleapis\.com/);
});

test("domain agent accepts owner-admin, Hercules internal, or scoped tenant API-key authorization",()=>{
  assert.match(agent,/ownerOrAdmin/);
  assert.match(agent,/internalAuthorized/);
  assert.match(agent,/apiKeyPrincipal/);
  assert.match(agent,/domain-agent-control/);
  assert.match(agent,/x-hercules-internal-key/);
  assert.match(agent,/x-hercules-api-key/);
  assert.match(agent,/owner_admin_internal_or_api_key_authorization_required/);
});

test("public discovery is honest about multiplex deployment and execution state",()=>{
  assert.match(agent,/hercules\.domain-agent\.discovery\.v1/);
  assert.match(agent,/agent\.sauceapproved\.com/);
  assert.match(agent,/hercules-private-bridge/);
  assert.match(agent,/automaticRefresh:true/);
  assert.match(agent,/providerNativeRefresh:true/);
  assert.match(agent,/refreshMetadata:true/);
  assert.match(agent,/executionAdapters:true/);
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


test("live private bridge advertises and enforces task validity windows",()=>{
  assert.match(agent,/taskValidityWindows:true/);
  assert.match(agent,/body\.not_before/);
  assert.match(agent,/body\.expires_at/);
  assert.match(agent,/TASK_NOT_YET_VALID/);
  assert.match(agent,/TASK_EXPIRED/);
  const windowCheck=agent.indexOf("taskWindowDecision(body)");
  const ownerBoundary=agent.indexOf("body.owner_boundary");
  const grantResolution=agent.indexOf("resolveGrant(principal.organizationId,body)");
  assert.ok(windowCheck>=0 && ownerBoundary>windowCheck && grantResolution>windowCheck);
});

test("live private bridge pins provider execution to a resolved grant fingerprint",()=>{
  assert.match(agent,/grantFingerprintPinning:true/);
  assert.match(agent,/expected_grant_fingerprint_sha256/);
  assert.match(agent,/grant_fingerprint_sha256/);
  assert.match(agent,/PROVIDER_GRANT_PIN_MISMATCH/);
  const pinCheck=agent.indexOf("assertGrantPin(body,grant)");
  const usage=agent.indexOf("recordUsage(principal,requestId");
  assert.ok(pinCheck>=0 && usage>pinCheck);
});


test("domain agent exposes a Spaceship DNS inspection adapter through the existing secure lane",()=>{
  assert.match(agent,/'spaceship\.dns\.inspect'/);
  assert.match(agent,/provider:'spaceship'/);
  assert.match(agent,/service:'hercules-private-bridge'/);
  assert.match(agent,/purpose:'spaceship-dns'/);
  assert.match(agent,/action:'inspect_shopify_dns'/);
  assert.match(agent,/resolveSpaceshipGrant/);
});

test("Spaceship authorization is derived from existing control state without reading raw credentials",()=>{
  assert.match(agent,/hercules_spaceship_dns_credentials/);
  assert.match(agent,/hercules_spaceship_mcp_oauth/);
  assert.match(agent,/spaceship_provider_authorization_required/);
  assert.match(agent,/credential_custody:'supabase_vault'/);
  assert.doesNotMatch(agent,/api_key_secret_ref|api_secret_secret_ref/);
  assert.doesNotMatch(agent,/hercules_get_secret.*spaceship/i);
});


test("Spaceship reconnect exposes a provider-native recovery fallback without resetting credentials",()=>{
  assert.match(agent,/accountRecoveryFallback:true/);
  assert.match(agent,/recovery_url/);
  assert.match(agent,/resetPassword/);
  assert.match(agent,/recovery_method_hint/);
  assert.doesNotMatch(agent,/submit.*resetPassword/i);
});
