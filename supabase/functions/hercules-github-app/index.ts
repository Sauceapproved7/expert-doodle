import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createAppAuth } from 'npm:@octokit/auth-app@8.3.1';

const U = Deno.env.get('SUPABASE_URL')!;
const A = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || Deno.env.get('SUPABASE_ANON_KEY') || '';
const S = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const admin = createClient(U, S, { auth: { persistSession: false } });

const OWNER = 'Sauceapproved7';
const REPO = 'expert-doodle';
const FULL_REPO = OWNER + '/' + REPO;
const PROVIDER = 'github_forge';
const VERIFY_BRANCH = 'hercules/expert-doodle-write';
const VERIFY_PATH = '.hercules/expert-doodle-write-test.md';
const FOUNDATION_BRANCH = 'hercules/v0.1.0-foundation';
const REQUIRED_MAIN_CHECKS = [
  'implementation-enforcement',
  'owner-code-only',
  'security-baseline',
  'codeql',
  'workflow-integrity',
  'provenance-attestation',
  'main-guard-contract'
];
const FOUNDATION_FILES: Record<string,string> = {"package.json":"{\n  \"name\":\"expert-doodle-hercules-target\",\n  \"version\":\"0.1.0\",\n  \"private\":true,\n  \"type\":\"module\",\n  \"engines\":{\"node\":\">=20\"},\n  \"scripts\":{\"validate\":\"node scripts/hercules-validate.mjs\",\"test\":\"node --test\",\"build\":\"npm run validate && npm test\"}\n}\n","hercules.config.json":"{\n  \"name\":\"expert-doodle\",\n  \"version\":\"0.1.0\",\n  \"role\":\"workload-target\",\n  \"repository\":\"Sauceapproved7/expert-doodle\",\n  \"defaultBranch\":\"main\",\n  \"controlPlane\":\"external-hercules\",\n  \"deployment\":{\"provider\":\"vercel\",\"healthPath\":\"/api/health\",\"statusPath\":\"/api/hercules/status\"},\n  \"boundaries\":{\"ownsGitHubCredentials\":false,\"ownsQueueOrchestration\":false,\"ownsSupabaseControlPlane\":false,\"directMainWrites\":false}\n}\n","lib/hercules/manifest.js":"export const HERCULES_TARGET=Object.freeze({name:\"expert-doodle\",version:\"0.1.0\",role:\"workload-target\",repository:\"Sauceapproved7/expert-doodle\",controlPlane:\"external-hercules\",capabilities:[\"health\",\"deployment-status\",\"git-commit-trace\"]});\nexport function deploymentIdentity(env=process.env){return{commit:env.VERCEL_GIT_COMMIT_SHA||env.GITHUB_SHA||env.COMMIT_SHA||\"local\",environment:env.VERCEL_ENV||env.NODE_ENV||\"local\"}}\n","api/health.js":"import{HERCULES_TARGET,deploymentIdentity}from\"../lib/hercules/manifest.js\";\nexport function createHealthPayload(env=process.env){return{ok:true,service:HERCULES_TARGET.name,version:HERCULES_TARGET.version,role:HERCULES_TARGET.role,...deploymentIdentity(env)}}\nexport default function handler(_req,res){res.setHeader(\"Cache-Control\",\"no-store\");res.status(200).json(createHealthPayload())}\n","api/hercules/status.js":"import{HERCULES_TARGET,deploymentIdentity}from\"../../lib/hercules/manifest.js\";\nexport default function handler(_req,res){res.setHeader(\"Cache-Control\",\"no-store\");res.status(200).json({ok:true,target:HERCULES_TARGET,deployment:deploymentIdentity()})}\n","scripts/hercules-validate.mjs":"import{access,readFile}from\"node:fs/promises\";import{constants}from\"node:fs\";\nconst required=[\"hercules.config.json\",\"api/health.js\",\"api/hercules/status.js\",\"lib/hercules/manifest.js\",\"vercel.json\"];\nfor(const f of required)await access(f,constants.R_OK);\nconst c=JSON.parse(await readFile(\"hercules.config.json\",\"utf8\"));const bad=[];\nif(c.name!==\"expert-doodle\")bad.push(\"name\");if(c.version!==\"0.1.0\")bad.push(\"version\");if(c.role!==\"workload-target\")bad.push(\"role\");\nif(c.repository!==\"Sauceapproved7/expert-doodle\")bad.push(\"repository\");if(c.controlPlane!==\"external-hercules\")bad.push(\"controlPlane\");\nif(c.deployment?.provider!==\"vercel\")bad.push(\"provider\");if(c.boundaries?.ownsGitHubCredentials!==false)bad.push(\"credentials\");\nif(c.boundaries?.ownsQueueOrchestration!==false)bad.push(\"queue\");if(c.boundaries?.ownsSupabaseControlPlane!==false)bad.push(\"controlPlaneOwnership\");\nif(c.boundaries?.directMainWrites!==false)bad.push(\"mainWrites\");if(bad.length){console.error(\"validation failed:\",bad.join(\",\"));process.exit(1)}\nconsole.log(\"Hercules target validation passed: expert-doodle v0.1.0\");\n","test/health.test.js":"import test from\"node:test\";import assert from\"node:assert/strict\";import{createHealthPayload}from\"../api/health.js\";\ntest(\"health identity\",()=>{const p=createHealthPayload({VERCEL_GIT_COMMIT_SHA:\"abc123\",VERCEL_ENV:\"preview\"});assert.equal(p.ok,true);assert.equal(p.service,\"expert-doodle\");assert.equal(p.version,\"0.1.0\");assert.equal(p.commit,\"abc123\");assert.equal(p.environment,\"preview\")});\n","vercel.json":"{\"version\":2,\"cleanUrls\":true,\"trailingSlash\":false}\n",".env.example":"# v0.1.0 intentionally requires no application secrets.\n","README.md":"# Expert Doodle\n\nSauceapproved7/expert-doodle is a deployable workload target controlled by the external Hercules control plane.\n\n## v0.1.0\n- role: workload-target\n- deployment: Vercel-compatible\n- health: /api/health\n- status: /api/hercules/status\n- validation: npm run build\n\nHercules credentials, queues, and control-plane source remain external to this repository.\n"};
const SELF = U + '/functions/v1/hercules-github-app';
const INTEGRATIONS = U + '/functions/v1/hercules-integrations';

const jsonHeaders = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: {
      location: url,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff'
    }
  });
}

function successPage(title: string, detail: string, ok = true) {
  const safeTitle = title.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
  const safeDetail = detail.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{margin:0;background:#090909;color:#f5f5f5;font-family:system-ui;display:grid;min-height:100vh;place-items:center}.c{width:min(680px,90vw);background:#141414;border:1px solid #333;border-radius:20px;padding:28px}a{color:#fff}.s{color:${ok?'#8be9a7':'#ff9b9b'}}</style><main class="c"><h1 class="s">${safeTitle}</h1><p>${safeDetail}</p><p><a href="${INTEGRATIONS}">Return to Hercules Integrations</a></p></main>`, {
    status: ok ? 200 : 400,
    headers: {
      'content-type':'text/html; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'x-frame-options':'DENY',
      'referrer-policy':'no-referrer'
    }
  });
}

async function actor(req: Request) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const db = createClient(U, A, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: membership } = await db.from('hercules_memberships')
    .select('organization_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .in('role', ['owner','admin'])
    .limit(1)
    .maybeSingle();
  return membership ? { user: data.user, membership } : null;
}

async function internalFinalizerAuthorized(req: Request) {
  const key = req.headers.get('x-hercules-internal-key') || '';
  if (!key) return false;
  const hash = await sha256(key);
  const { data } = await admin.from('hercules_internal_service_keys')
    .select('purpose,key_sha256,enabled')
    .eq('purpose','github-finalizer')
    .eq('enabled',true)
    .maybeSingle();
  return Boolean(data?.key_sha256 && data.key_sha256 === hash);
}

async function sha256(s: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function readSecret(ref: string) {
  const { data, error } = await admin.rpc('hercules_get_secret', { p_id: ref });
  if (error || !data) throw new Error('secret_unavailable');
  return String(data);
}

async function storeSecret(value: string, name: string, description: string) {
  const { data, error } = await admin.rpc('hercules_store_secret', {
    p_value: value,
    p_name: name,
    p_description: description
  });
  if (error || !data) throw new Error('secret_store_failed');
  return String(data);
}

async function stateByPlain(state: string) {
  const stateHash = await sha256(state);
  const { data } = await admin.from('hercules_github_app_states')
    .select('*')
    .eq('state_hash', stateHash)
    .gt('expires_at', new Date().toISOString())
    .is('consumed_at', null)
    .maybeSingle();
  return data || null;
}

async function github(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch('https://api.github.com' + path, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'SauceApproved-Hercules-GitHub-App',
      ...(init.headers || {})
    }
  });
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) {
    const e = new Error('github_' + r.status);
    (e as any).status = r.status;
    (e as any).body = body;
    throw e;
  }
  return body;
}

async function appTokens(appId: number|string, privateKey: string, installationId?: number) {
  const auth = createAppAuth({ appId, privateKey });
  const app = await auth({ type: 'app' });
  if (!installationId) return { appToken: app.token, installationToken: null as string|null };
  const install = await auth({ type: 'installation', installationId });
  return { appToken: app.token, installationToken: install.token };
}

const IP_BRANCH = 'hercules/ip-ownership-hardening-20260922';
const IP_LICENSE = "Copyright (c) 2026 Sauceapproved7. All rights reserved.\n\nThis repository and its proprietary source code, documentation, workflows, configuration, designs, and related materials are proprietary except where a file, directory, dependency, or component is expressly identified as third-party or licensed under different terms.\n\nNo permission is granted to use, copy, modify, reproduce, distribute, sublicense, sell, publish, disclose, or create derivative works from proprietary Hercules materials except under a separate written license or authorization from the copyright holder.\n\nThird-party software and materials remain subject to their respective licenses and notices.\n\nThis notice does not revoke or alter rights that were validly granted for earlier versions or commits under the Apache License 2.0 or another prior license.\n\nTHE MATERIALS ARE PROVIDED \"AS IS\" WITHOUT WARRANTIES OF ANY KIND TO THE MAXIMUM EXTENT PERMITTED BY LAW.\n";
const IP_FILES: Record<string,string> = {"LICENSE":"Copyright (c) 2026 Sauceapproved7. All rights reserved.\n\nThis repository and its proprietary source code, documentation, workflows, configuration, designs, and related materials are proprietary except where a file, directory, dependency, or component is expressly identified as third-party or licensed under different terms.\n\nNo permission is granted to use, copy, modify, reproduce, distribute, sublicense, sell, publish, disclose, or create derivative works from proprietary Hercules materials except under a separate written license or authorization from the copyright holder.\n\nThird-party software and materials remain subject to their respective licenses and notices.\n\nThis notice does not revoke or alter rights that were validly granted for earlier versions or commits under the Apache License 2.0 or another prior license.\n\nTHE MATERIALS ARE PROVIDED \"AS IS\" WITHOUT WARRANTIES OF ANY KIND TO THE MAXIMUM EXTENT PERMITTED BY LAW.\n","COPYRIGHT.md":"# Copyright\n\nCopyright (c) 2026 Sauceapproved7.\n\nProprietary Hercules materials are reserved to the copyright holder except for third-party components or files expressly carrying another license.\n\nRepository history, commit metadata, release records, design records, and provenance records should be retained as supporting evidence of creation and control.\n","IP_PROVENANCE.md":"# IP Provenance\n\nMaintain provenance for every material Hercules component.\n\n| Field | Required |\n| --- | --- |\n| Component or file name | Yes |\n| Creation or acquisition date | Yes |\n| Repository commit or artifact ID | Yes |\n| Human author or authorized source | Yes |\n| AI assistance used | Yes |\n| Third-party source, if any | Yes |\n| Applicable license | Yes |\n| Modifications made | Yes |\n| Approval or merge record | Yes |\n| First release/version containing the component | Yes |\n\nDo not merge code or assets of uncertain origin. Third-party material must have a documented source and a compatible license.\n","CONTRIBUTING.md":"# Contributing\n\nHercules does not accept external code, documentation, designs, datasets, or other contributions for incorporation into proprietary releases unless the contributor has authority to provide them and the contribution is covered by an approved written contribution/IP agreement.\n\nDo not merge an external contribution until provenance and license/ownership have been verified.\n\nContributors must identify third-party material and must not submit confidential, stolen, misappropriated, or license-incompatible content.\n","THIRD_PARTY_NOTICES.md":"# Third-Party Notices\n\nMaintain the following inventory for every third-party dependency or asset.\n\n| Package/component | Version | Source | License | Copyright/notice requirement | Modification status | Distribution obligations |\n| --- | --- | --- | --- | --- | --- | --- |\n\nBaseline: no application dependency manifest was present at the repository root during the 2026-09-22 ownership review.\n\nRe-run this inventory whenever package manifests, vendored code, binaries, models, datasets, fonts, media, or other dependencies are added.\n","LICENSING_HISTORY.md":"# Licensing History\n\n## 2026-09-22 ownership-hardening transition\n\nThis repository previously used the Apache License 2.0.\n\nRights validly granted for earlier versions or commits under Apache-2.0 are not retroactively withdrawn.\n\nLater proprietary Hercules releases are governed by the LICENSE file and any component-specific notices in effect for that release.\n\nThird-party components retain their own licenses.\n\nPreserve the transition commit SHA and date as part of repository history.\n"};

function decodeGithubBase64(v:string){
  const raw=atob(v.replace(/\n/g,''));
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function applyIpOwnership(installationToken:string){
  const encodedBranch=IP_BRANCH.split('/').map(encodeURIComponent).join('/');
  let branchSha='';
  try{
    const existing=await github(installationToken, `/repos/${OWNER}/${REPO}/git/ref/heads/${encodedBranch}`);
    branchSha=String(existing?.object?.sha||'');
  }catch(e){ if((e as any).status!==404) throw e; }
  if(branchSha){
    try{
      const lic=await github(installationToken, `/repos/${OWNER}/${REPO}/contents/LICENSE?ref=${encodeURIComponent(IP_BRANCH)}`);
      const hist=await github(installationToken, `/repos/${OWNER}/${REPO}/contents/LICENSING_HISTORY.md?ref=${encodeURIComponent(IP_BRANCH)}`);
      if(decodeGithubBase64(String(lic?.content||''))===IP_LICENSE && decodeGithubBase64(String(hist?.content||'')).includes('2026-09-22 ownership-hardening transition')){
        const pulls=await github(installationToken, `/repos/${OWNER}/${REPO}/pulls?state=open&head=${encodeURIComponent(OWNER+':'+IP_BRANCH)}&base=main`);
        return {ok:true,alreadyApplied:true,branch:IP_BRANCH,commitSha:branchSha,pullRequest:Array.isArray(pulls)&&pulls[0]?{number:pulls[0].number,url:pulls[0].html_url}:null};
      }
    }catch(_){}
  }
  let parentSha=branchSha;
  if(!parentSha){
    const main=await github(installationToken, `/repos/${OWNER}/${REPO}/git/ref/heads/main`);
    parentSha=String(main?.object?.sha||'');
  }
  if(!parentSha) throw new Error('ip_parent_branch_unresolved');
  const parentCommit=await github(installationToken, `/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
  const baseTree=String(parentCommit?.tree?.sha||'');
  if(!baseTree) throw new Error('ip_base_tree_unresolved');
  const readRef=branchSha?IP_BRANCH:'main';
  let readme='# expert-doodle\n';
  try{
    const current=await github(installationToken, `/repos/${OWNER}/${REPO}/contents/README.md?ref=${encodeURIComponent(readRef)}`);
    readme=decodeGithubBase64(String(current?.content||''));
  }catch(_){}
  if(!readme.includes('## Ownership and Licensing')){
    if(!readme.endsWith('\n')) readme+='\n';
    readme+='\n## Ownership and Licensing\n\nUnless otherwise stated for a specific component, current Hercules proprietary work is all rights reserved. Third-party components retain their own licenses. See LICENSE, LICENSING_HISTORY.md, IP_PROVENANCE.md, and THIRD_PARTY_NOTICES.md.\n';
  }
  const desired={...IP_FILES,'README.md':readme};
  const tree:any[]=[];
  for(const [path,content] of Object.entries(desired)){
    const blob=await github(installationToken, `/repos/${OWNER}/${REPO}/git/blobs`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content,encoding:'utf-8'})});
    tree.push({path,mode:'100644',type:'blob',sha:String(blob?.sha||'')});
  }
  const nextTree=await github(installationToken, `/repos/${OWNER}/${REPO}/git/trees`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({base_tree:baseTree,tree})});
  const commit=await github(installationToken, `/repos/${OWNER}/${REPO}/git/commits`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'docs: harden Hercules IP ownership and provenance controls',tree:String(nextTree?.sha||''),parents:[parentSha]})});
  const commitSha=String(commit?.sha||'');
  if(!commitSha) throw new Error('ip_commit_failed');
  if(branchSha){
    await github(installationToken, `/repos/${OWNER}/${REPO}/git/refs/heads/${encodedBranch}`, {method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({sha:commitSha,force:false})});
  }else{
    await github(installationToken, `/repos/${OWNER}/${REPO}/git/refs`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ref:'refs/heads/'+IP_BRANCH,sha:commitSha})});
  }
  let pr:any=null;
  const pulls=await github(installationToken, `/repos/${OWNER}/${REPO}/pulls?state=open&head=${encodeURIComponent(OWNER+':'+IP_BRANCH)}&base=main`);
  if(Array.isArray(pulls)&&pulls[0]) pr={number:pulls[0].number,url:pulls[0].html_url};
  else{
    const created=await github(installationToken, `/repos/${OWNER}/${REPO}/pulls`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Harden Hercules IP ownership and provenance controls',head:IP_BRANCH,base:'main',body:'Implements the approved Hercules ownership/provenance package. Preserves repository history and explicitly records that rights already granted for earlier Apache-2.0 versions are not retroactively withdrawn. No proprietary Hercules control-plane source or credentials are included.'})});
    pr={number:created?.number||null,url:created?.html_url||null};
  }
  return {ok:true,alreadyApplied:false,branch:IP_BRANCH,commitSha,fileCount:Object.keys(desired).length,pullRequest:pr,mainModified:false};
}

async function enforceMainProtection(installationToken: string) {
  const protection = await github(
    installationToken,
    `/repos/${OWNER}/${REPO}/branches/main/protection`,
    {
      method:'PUT',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        required_status_checks:{
          strict:true,
          contexts:REQUIRED_MAIN_CHECKS
        },
        enforce_admins:true,
        required_pull_request_reviews:{
          dismiss_stale_reviews:false,
          require_code_owner_reviews:false,
          required_approving_review_count:0,
          require_last_push_approval:false
        },
        restrictions:null,
        required_linear_history:false,
        allow_force_pushes:false,
        allow_deletions:false,
        block_creations:false,
        required_conversation_resolution:true,
        lock_branch:false,
        allow_fork_syncing:false
      })
    }
  );

  const contexts = Array.isArray(protection?.required_status_checks?.contexts)
    ? protection.required_status_checks.contexts.map((v:any)=>String(v))
    : [];
  const missingChecks = REQUIRED_MAIN_CHECKS.filter(check => !contexts.includes(check));
  if (missingChecks.length) {
    throw new Error('main_protection_missing_checks:' + missingChecks.join(','));
  }
  if (protection?.enforce_admins?.enabled !== true) {
    throw new Error('main_protection_admin_enforcement_missing');
  }
  if (!protection?.required_pull_request_reviews) {
    throw new Error('main_protection_pull_request_requirement_missing');
  }
  if (protection?.required_conversation_resolution?.enabled !== true) {
    throw new Error('main_protection_conversation_resolution_missing');
  }
  if (protection?.allow_force_pushes?.enabled === true) {
    throw new Error('main_protection_force_push_enabled');
  }
  if (protection?.allow_deletions?.enabled === true) {
    throw new Error('main_protection_deletion_enabled');
  }

  return {
    ok:true,
    repository:FULL_REPO,
    branch:'main',
    protected:true,
    strict:true,
    enforceAdmins:true,
    pullRequestRequired:true,
    requiredChecks:REQUIRED_MAIN_CHECKS,
    requiredConversationResolution:true,
    forcePushesAllowed:false,
    deletionsAllowed:false,
    verifiedAt:new Date().toISOString()
  };
}

async function reconcileConnection(conn: any) {
  if (!conn?.secret_ref || !conn?.metadata?.app_id) {
    return { ok:false, reason:'github_app_not_created' };
  }

  const privateKey = await readSecret(String(conn.secret_ref));
  const { appToken } = await appTokens(String(conn.metadata.app_id), privateKey);
  const installations = await github(String(appToken), '/app/installations?per_page=100');

  const candidates = Array.isArray(installations)
    ? installations.filter((i:any) => String(i?.account?.login || '').toLowerCase() === OWNER.toLowerCase())
    : [];

  for (const installation of candidates) {
    const installationId = Number(installation?.id || 0);
    if (!Number.isInteger(installationId) || installationId <= 0) continue;

    try {
      const tokens = await appTokens(String(conn.metadata.app_id), privateKey, installationId);
      const repos = await github(String(tokens.installationToken), '/installation/repositories?per_page=100');
      const hasTarget = Array.isArray(repos?.repositories) && repos.repositories.some(
        (r:any) => String(r?.full_name || '').toLowerCase() === FULL_REPO.toLowerCase()
      );
      if (!hasTarget) continue;

      const verification = await verifyWrite(String(tokens.installationToken));
      const foundation = await bootstrapFoundation(String(tokens.installationToken));
      const ipOwnership = await applyIpOwnership(String(tokens.installationToken));
      const branchProtection = await enforceMainProtection(String(tokens.installationToken));

      const metadata = {
        ...(conn.metadata || {}),
        installation_id: installationId,
        installation_account: String(installation?.account?.login || OWNER),
        repository: FULL_REPO,
        write_verified: true,
        verification,
        expert_doodle_foundation: foundation,
        ip_ownership: ipOwnership,
        branch_protection: branchProtection,
        reconciled_at: new Date().toISOString()
      };

      await admin.from('hercules_provider_connections').update({
        status:'active',
        connected_at: conn.connected_at || new Date().toISOString(),
        last_error:null,
        metadata,
        updated_at:new Date().toISOString()
      }).eq('id',conn.id);

      return { ok:true, installationId, verification, foundation, ipOwnership, branchProtection, metadata };
    } catch (_) {
      // Try the next matching installation; final failure is reported below.
    }
  }

  return { ok:false, reason:'installation_not_found_for_expert_doodle' };
}


async function bootstrapFoundation(installationToken: string) {
  const encodedBranch = FOUNDATION_BRANCH.split('/').map(encodeURIComponent).join('/');
  try {
    const existingRef = await github(installationToken, `/repos/${OWNER}/${REPO}/git/ref/heads/${encodedBranch}`);
    const existingSha = String(existingRef?.object?.sha || '');
    if (existingSha) {
      try {
        const pkg = await github(installationToken, `/repos/${OWNER}/${REPO}/contents/package.json?ref=${encodeURIComponent(FOUNDATION_BRANCH)}`);
        const raw = atob(String(pkg?.content || '').replace(/\\n/g,''));
        const parsed = JSON.parse(raw);
        if (parsed?.name === 'expert-doodle-hercules-target' && parsed?.version === '0.1.0') {
          return { ok:true, alreadyBuilt:true, branch:FOUNDATION_BRANCH, commitSha:existingSha, fileCount:Object.keys(FOUNDATION_FILES).length, mainModified:false };
        }
      } catch (_) {}
      throw new Error('foundation_branch_exists_unrecognized');
    }
  } catch (e) {
    if ((e as any).status !== 404 && (e as Error).message !== 'foundation_branch_exists_unrecognized') throw e;
    if ((e as Error).message === 'foundation_branch_exists_unrecognized') throw e;
  }

  const repo = await github(installationToken, `/repos/${OWNER}/${REPO}`);
  const defaultBranch = String(repo?.default_branch || 'main');
  if (defaultBranch !== 'main') throw new Error('unexpected_default_branch');
  const base = await github(installationToken, `/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
  const baseSha = String(base?.object?.sha || '');
  if (!baseSha) throw new Error('base_branch_unresolved');
  const baseCommit = await github(installationToken, `/repos/${OWNER}/${REPO}/git/commits/${baseSha}`);
  const baseTree = String(baseCommit?.tree?.sha || '');
  if (!baseTree) throw new Error('base_tree_unresolved');

  const tree:any[] = [];
  for (const [path, content] of Object.entries(FOUNDATION_FILES)) {
    const blob = await github(installationToken, `/repos/${OWNER}/${REPO}/git/blobs`, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({content,encoding:'utf-8'})
    });
    tree.push({path,mode:'100644',type:'blob',sha:String(blob?.sha || '')});
  }

  const nextTree = await github(installationToken, `/repos/${OWNER}/${REPO}/git/trees`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({base_tree:baseTree,tree})
  });
  const commit = await github(installationToken, `/repos/${OWNER}/${REPO}/git/commits`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({message:'feat: bootstrap Expert Doodle Hercules workload v0.1.0',tree:String(nextTree?.sha || ''),parents:[baseSha]})
  });
  const commitSha = String(commit?.sha || '');
  if (!commitSha) throw new Error('foundation_commit_failed');

  await github(installationToken, `/repos/${OWNER}/${REPO}/git/refs`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({ref:'refs/heads/' + FOUNDATION_BRANCH,sha:commitSha})
  });
  return {ok:true,alreadyBuilt:false,branch:FOUNDATION_BRANCH,commitSha,fileCount:Object.keys(FOUNDATION_FILES).length,mainModified:false};
}

async function verifyWrite(installationToken: string) {
  const repo = await github(installationToken, `/repos/${OWNER}/${REPO}`);
  if (String(repo?.full_name || '').toLowerCase() !== FULL_REPO.toLowerCase()) {
    throw new Error('expert_doodle_not_authorized');
  }
  const defaultBranch = String(repo?.default_branch || 'main');
  const branchPath = VERIFY_BRANCH.split('/').map(encodeURIComponent).join('/');
  let branchExists = true;
  try {
    await github(installationToken, `/repos/${OWNER}/${REPO}/git/ref/heads/${branchPath}`);
  } catch (e) {
    if ((e as any).status === 404) branchExists = false;
    else throw e;
  }

  if (!branchExists) {
    const base = await github(installationToken, `/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
    const sha = String(base?.object?.sha || '');
    if (!sha) throw new Error('base_branch_unresolved');
    await github(installationToken, `/repos/${OWNER}/${REPO}/git/refs`, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ ref: 'refs/heads/' + VERIFY_BRANCH, sha })
    });
  }

  const encodedPath = VERIFY_PATH.split('/').map(encodeURIComponent).join('/');
  const contentPath = `/repos/${OWNER}/${REPO}/contents/${encodedPath}?ref=${encodeURIComponent(VERIFY_BRANCH)}`;
  try {
    const existing = await github(installationToken, contentPath);
    return {
      ok: true,
      alreadyVerified: true,
      repository: FULL_REPO,
      branch: VERIFY_BRANCH,
      path: VERIFY_PATH,
      blobSha: String(existing?.sha || ''),
      mainModified: false,
      sourcePublished: false
    };
  } catch (e) {
    if ((e as any).status !== 404) throw e;
  }

  const marker = [
    '# Hercules Expert Doodle GitHub App Verification',
    '',
    'GitHub App installation access verified.',
    'This file contains no proprietary Hercules source.',
    'Main was not modified.',
    'Repository: ' + FULL_REPO,
    ''
  ].join('\n');

  const write = await github(installationToken, `/repos/${OWNER}/${REPO}/contents/${encodedPath}`, {
    method:'PUT',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      message:'chore: verify Hercules Expert Doodle GitHub App bridge',
      content:btoa(marker),
      branch:VERIFY_BRANCH
    })
  });

  return {
    ok:true,
    alreadyVerified:false,
    repository:FULL_REPO,
    branch:VERIFY_BRANCH,
    path:VERIFY_PATH,
    commitSha:String(write?.commit?.sha || ''),
    commitUrl:String(write?.commit?.html_url || ''),
    mainModified:false,
    sourcePublished:false
  };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('stage') === 'launch') {
    const state = String(url.searchParams.get('state') || '');
    if (!state) return successPage('GitHub App setup failed','Missing launch state.',false);
    const s = await stateByPlain(state);
    if (!s || s.status !== 'started') return successPage('GitHub App setup failed','This Hercules launch link is invalid or expired.',false);

    const manifest = {
      name: String(s.app_name),
      url: INTEGRATIONS,
      redirect_url: SELF + '?stage=manifest',
      setup_url: SELF + '?stage=setup&state=' + encodeURIComponent(state),
      setup_on_update: true,
      public: false,
      default_permissions: { administration: 'write', contents: 'write', pull_requests: 'write' },
      default_events: []
    };

    const action = 'https://github.com/settings/apps/new';
    const stateEsc = state.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
    const manifestEsc = JSON.stringify(manifest).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connecting Expert Doodle</title><style>body{margin:0;background:#090909;color:#f5f5f5;font-family:system-ui;display:grid;min-height:100vh;place-items:center}.c{width:min(680px,90vw);background:#141414;border:1px solid #333;border-radius:20px;padding:28px}button{background:#fff;color:#080808;border:0;border-radius:12px;padding:14px 18px;font-weight:800;font-size:16px}.muted{color:#aaa}</style></head><body><main class="c"><h1>Connecting Expert Doodle</h1><p>Opening GitHub authorization for <b>Sauceapproved7/expert-doodle</b>.</p><p class="muted">If GitHub does not open automatically, tap the button.</p><form id="f" method="POST" action="${action}"><input type="hidden" name="state" value="${stateEsc}"><input type="hidden" name="manifest" value="${manifestEsc}"><button type="submit">Continue to GitHub</button></form></main><script>setTimeout(function(){document.getElementById('f').submit()},250)</script></body></html>`, {
      headers:{
        'content-type':'text/html; charset=UTF-8',
        'cache-control':'no-store, no-cache, must-revalidate',
        'pragma':'no-cache',
        'x-frame-options':'DENY',
        'referrer-policy':'no-referrer',
        'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action https://github.com; base-uri 'none'; frame-ancestors 'none'"
      }
    });
  }

  if (req.method === 'GET' && url.searchParams.get('stage') === 'status') {
    const { data: rows } = await admin.from('hercules_provider_connections')
      .select('*')
      .eq('provider', PROVIDER)
      .eq('account_key', FULL_REPO)
      .order('updated_at', { ascending:false })
      .limit(1);
    let c = rows?.[0] || null;
    let reconciliation:any = null;

    if (c && c.status !== 'active' && c.secret_ref && c?.metadata?.app_id) {
      try {
        reconciliation = await reconcileConnection(c);
        if (reconciliation?.ok) {
          const { data: refreshed } = await admin.from('hercules_provider_connections')
            .select('*')
            .eq('id', c.id)
            .maybeSingle();
          if (refreshed) c = refreshed;
        }
      } catch (e) {
        reconciliation = { ok:false, reason:e instanceof Error ? e.message : 'reconcile_failed' };
      }
    }

    return out({
      ok:true,
      repository:FULL_REPO,
      connected:c?.status === 'active' && c?.metadata?.write_verified === true,
      status:c?.status || 'not_configured',
      connectedAt:c?.connected_at || null,
      lastError:c?.last_error || null,
      installationId:c?.metadata?.installation_id || null,
      installationAccount:c?.metadata?.installation_account || null,
      writeVerified:c?.metadata?.write_verified === true,
      ipOwnership:c?.metadata?.ip_ownership || null,
      reconciliation,
      verificationBranch:VERIFY_BRANCH,
      verificationPath:VERIFY_PATH,
      mainModified:false,
      proprietarySourcePublished:false,
      updatedAt:c?.updated_at || null
    });
  }

  if (req.method === 'GET' && !url.searchParams.get('stage')) {
    return out({
      ok:true,
      service:'hercules-github-app',
      version:'2.0.0',
      repository:FULL_REPO,
      permissions:{administration:'write',contents:'write',pull_requests:'write'},
      verificationBranch:VERIFY_BRANCH,
      verificationPath:VERIFY_PATH
    });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'reconcile') {
      const internalOk = await internalFinalizerAuthorized(req);
      const a = internalOk ? null : await actor(req);
      if (!internalOk && !a) return out({error:'owner_admin_or_internal_required'},403);

      let q = admin.from('hercules_provider_connections')
        .select('*')
        .eq('provider',PROVIDER)
        .eq('account_key',FULL_REPO);
      if (a) q = q.eq('organization_id',a.membership.organization_id);
      const { data: conn } = await q.maybeSingle();

      if (!conn) return out({ok:false,error:'forge_connection_missing'},404);
      const result = await reconcileConnection(conn);
      return out({repository:FULL_REPO,...result}, result.ok ? 200 : 409);
    }

    const a = await actor(req);
    if (!a) return out({error:'owner_or_admin_required'},403);
    if (action !== 'start') return out({error:'unknown_action'},400);

    const state = randomState();
    const stateHash = await sha256(state);
    const suffix = state.slice(0,8);
    const appName = 'sauceapproved-hercules-' + suffix;
    const expires = new Date(Date.now() + 55 * 60 * 1000).toISOString();

    const { error } = await admin.from('hercules_github_app_states').insert({
      organization_id:a.membership.organization_id,
      state_hash:stateHash,
      app_name:appName,
      status:'started',
      expires_at:expires,
      metadata:{repository:FULL_REPO,owner:OWNER}
    });
    if (error) return out({error:'state_store_failed'},500);

    const manifest = {
      name: appName,
      url: INTEGRATIONS,
      redirect_url: SELF + '?stage=manifest',
      setup_url: SELF + '?stage=setup&state=' + encodeURIComponent(state),
      setup_on_update: true,
      public: false,
      default_permissions: { administration: 'write', contents: 'write', pull_requests: 'write' },
      default_events: []
    };

    return out({
      ok:true,
      action:'https://github.com/settings/apps/new?state=' + encodeURIComponent(state),
      manifest:JSON.stringify(manifest),
      expiresAt:expires,
      repository:FULL_REPO
    });
  }

  if (req.method === 'GET' && url.searchParams.get('stage') === 'manifest') {
    const code = String(url.searchParams.get('code') || '');
    const state = String(url.searchParams.get('state') || '');
    if (!code || !state) return successPage('GitHub App setup failed','Missing GitHub manifest code or state.',false);

    const s = await stateByPlain(state);
    if (!s || s.status !== 'started') return successPage('GitHub App setup failed','The Hercules setup session is invalid or expired.',false);

    const r = await fetch('https://api.github.com/app-manifests/' + encodeURIComponent(code) + '/conversions', {
      method:'POST',
      headers:{
        accept:'application/vnd.github+json',
        'x-github-api-version':'2022-11-28',
        'user-agent':'SauceApproved-Hercules-GitHub-App'
      }
    });
    const cfg = await r.json().catch(() => ({}));
    if (!r.ok || !cfg?.id || !cfg?.pem || !cfg?.slug) {
      await admin.from('hercules_github_app_states').update({
        status:'error',
        metadata:{...(s.metadata || {}), manifest_error:'conversion_failed'},
        updated_at:new Date().toISOString()
      }).eq('id',s.id);
      return successPage('GitHub App setup failed','GitHub did not return a valid app configuration.',false);
    }

    const privateRef = await storeSecret(
      String(cfg.pem),
      'hercules_github_app_private_' + String(s.organization_id),
      'Hercules Expert Doodle GitHub App private key'
    );
    const webhookRef = cfg.webhook_secret ? await storeSecret(
      String(cfg.webhook_secret),
      'hercules_github_app_webhook_' + String(s.organization_id),
      'Hercules Expert Doodle GitHub App webhook secret'
    ) : null;

    const { error: ce } = await admin.from('hercules_provider_connections').upsert({
      organization_id:s.organization_id,
      provider:PROVIDER,
      account_key:FULL_REPO,
      client_id:String(cfg.client_id || ''),
      secret_ref:privateRef,
      signing_secret_ref:webhookRef,
      access_secret_ref:null,
      status:'pending',
      connected_at:null,
      last_error:'installation_required',
      metadata:{
        owner:OWNER,
        repository:FULL_REPO,
        auth_mode:'github_app_manifest',
        app_id:String(cfg.id),
        app_slug:String(cfg.slug),
        installation_id:null,
        permissions:{administration:'write',contents:'write',pull_requests:'write'},
        verification_branch:VERIFY_BRANCH,
        verification_path:VERIFY_PATH,
        write_policy:'expert-doodle-bridge'
      },
      updated_at:new Date().toISOString()
    }, { onConflict:'organization_id,provider,account_key' });
    if (ce) return successPage('GitHub App setup failed','Hercules could not store the GitHub App connection.',false);

    await admin.from('hercules_github_app_states').update({
      status:'app_created',
      metadata:{...(s.metadata || {}), app_id:String(cfg.id), app_slug:String(cfg.slug)},
      updated_at:new Date().toISOString()
    }).eq('id',s.id);

    return redirect('https://github.com/apps/' + encodeURIComponent(String(cfg.slug)) + '/installations/new');
  }

  if (req.method === 'GET' && url.searchParams.get('stage') === 'setup') {
    const state = String(url.searchParams.get('state') || '');
    const installationId = Number(url.searchParams.get('installation_id') || '0');
    if (!state || !Number.isInteger(installationId) || installationId <= 0) {
      return successPage('GitHub installation failed','Missing installation information.',false);
    }

    const s = await stateByPlain(state);
    if (!s || s.status !== 'app_created') {
      return successPage('GitHub installation failed','The Hercules installation session is invalid or expired.',false);
    }

    const { data: conn } = await admin.from('hercules_provider_connections')
      .select('*')
      .eq('organization_id',s.organization_id)
      .eq('provider',PROVIDER)
      .eq('account_key',FULL_REPO)
      .maybeSingle();

    if (!conn?.secret_ref || !conn?.metadata?.app_id) {
      return successPage('GitHub installation failed','The Hercules GitHub App configuration is incomplete.',false);
    }

    try {
      // Do not trust the browser-supplied installation_id by itself.
      // Reconcile against installations returned by GitHub using the app's own credentials.
      const result = await reconcileConnection(conn);
      if (!result.ok) throw new Error(result.reason || 'installation_verification_failed');

      await admin.from('hercules_github_app_states').update({
        status:'installed',
        consumed_at:new Date().toISOString(),
        metadata:{...(s.metadata || {}), installation_id:result.installationId, verification:result.verification},
        updated_at:new Date().toISOString()
      }).eq('id',s.id);

      return successPage('Expert Doodle connected','Hercules verified GitHub App write access on the dedicated branch. Main was not modified.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'installation_verification_failed';
      await admin.from('hercules_provider_connections').update({
        status:'error',
        last_error:message,
        updated_at:new Date().toISOString()
      }).eq('id',conn.id);
      await admin.from('hercules_github_app_states').update({
        status:'error',
        metadata:{...(s.metadata || {}), installation_error:message},
        updated_at:new Date().toISOString()
      }).eq('id',s.id);
      return successPage('GitHub installation failed','Hercules could not verify Expert Doodle access: ' + message,false);
    }
  }

  return out({error:'method_not_allowed'},405);
});