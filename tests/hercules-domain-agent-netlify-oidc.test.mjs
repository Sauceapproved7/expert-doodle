import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const agent=await readFile(new URL("../supabase/functions/hercules-private-bridge/domain-agent.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20260927203000_hercules_domain_agent_netlify_oidc_v1.sql",import.meta.url),"utf8");
const workflow=await readFile(new URL("../.github/workflows/hercules-domain-agent-netlify-deploy.yml",import.meta.url),"utf8");

test("Netlify deploy authority is consumed through a one-time service-role RPC",()=>{
  assert.match(migration,/hercules_domain_agent_stage_netlify_deploy_proxy/);
  assert.match(migration,/hercules_domain_agent_consume_netlify_deploy_proxy/);
  assert.match(migration,/for update/i);
  assert.match(migration,/enabled=false/i);
  assert.match(migration,/hercules_get_secret/);
  assert.match(migration,/revoke all on function public\.hercules_domain_agent_consume_netlify_deploy_proxy/i);
  assert.match(migration,/grant execute on function public\.hercules_domain_agent_consume_netlify_deploy_proxy\(\) to service_role/i);
});

test("Domain Agent validates GitHub Actions OIDC before releasing deploy authority",()=>{
  assert.match(agent,/token\.actions\.githubusercontent\.com/);
  assert.match(agent,/openid-configuration/);
  assert.match(agent,/RSASSA-PKCS1-v1_5/);
  assert.match(agent,/hercules-netlify-deploy/);
  assert.match(agent,/Sauceapproved7\/expert-doodle/);
  assert.match(agent,/1349819313/);
  assert.match(agent,/322199890/);
  assert.match(agent,/refs\/heads\/main/);
  assert.match(agent,/Hercules Domain Agent Netlify Deploy/);
  assert.match(agent,/hercules_domain_agent_consume_netlify_deploy_proxy/);
});

test("Netlify deploy OIDC endpoint does not accept ordinary Domain Agent auth",()=>{
  assert.match(agent,/domain_agent_netlify_deploy_handoff/);
  assert.match(agent,/github_actions_oidc_required/);
  assert.match(agent,/verifyGitHubOidc/);
});

test("GitHub workflow has OIDC-only deploy permissions and a dormant trigger marker",()=>{
  assert.match(workflow,/id-token:\s*write/);
  assert.match(workflow,/contents:\s*read/);
  assert.match(workflow,/\.hercules\/netlify-domain-agent-deploy\.trigger/);
  assert.match(workflow,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(workflow,/audience=hercules-netlify-deploy/);
  assert.match(workflow,/domain_agent_netlify_deploy_handoff/);
  assert.match(workflow,/npx -y @netlify\/mcp@latest/);
  assert.match(workflow,/6bbb52f4-ee2d-440a-a201-c6a12057f4bf/);
  assert.doesNotMatch(workflow,/NETLIFY_PERSONAL_ACCESS_TOKEN|NETLIFY_AUTH_TOKEN/);
});

test("workflow masks the one-time Netlify proxy before use",()=>{
  assert.match(workflow,/::add-mask::\$PROXY_PATH/);
  assert.match(workflow,/--proxy-path "\$PROXY_PATH"/);
});
