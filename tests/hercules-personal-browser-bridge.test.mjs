import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const manifest=JSON.parse(await readFile(new URL("../hercules-runtime/personal-browser-bridge/manifest.json",import.meta.url),"utf8"));
const background=await readFile(new URL("../hercules-runtime/personal-browser-bridge/background.js",import.meta.url),"utf8");
const popup=await readFile(new URL("../hercules-runtime/personal-browser-bridge/popup.js",import.meta.url),"utf8");
const edge=await readFile(new URL("../supabase/functions/hercules-private-bridge/personal-browser.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20260927122500_hercules_personal_browser_bridge_v1.sql",import.meta.url),"utf8");

test("personal browser bridge requests only bounded browser permissions",()=>{
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual((manifest.permissions||[]).sort(),["activeTab","scripting","storage","tabs"].sort());
  assert.deepEqual(manifest.host_permissions||[],["https://xbwuablxhhwsaoomsoco.supabase.co/*"]);
  assert.deepEqual(manifest.optional_host_permissions||[],["https://*/*"]);
  assert.ok(!(manifest.permissions||[]).includes("cookies"));
  assert.ok(!(manifest.permissions||[]).includes("webRequest"));
});

test("owner must explicitly grant the current site before Hercules can control it",()=>{
  assert.match(popup,/chrome\.permissions\.request/);
  assert.match(popup,/origins:\[origin\+"\/\*"\]/);
  assert.match(popup,/share_current_tab/);
  assert.match(background,/site_permission_required/);
});

test("bridge refuses secret-bearing fields and human-verification controls",()=>{
  assert.match(background,/type===["']password["']/i);
  assert.match(background,/one-time-code/i);
  assert.match(background,/captcha/i);
  assert.match(background,/human_verification_required/);
  assert.match(background,/secret_field_blocked/);
  assert.doesNotMatch(background,/chrome\.cookies/);
});

test("bridge command surface is allowlisted and cannot execute arbitrary JavaScript",()=>{
  assert.match(background,/new Set\(\[["']observe["'],["']click["'],["']type["'],["']navigate["'],["']close["']\]\)/);
  assert.doesNotMatch(background,/eval\(/);
  assert.doesNotMatch(background,/new Function/);
  assert.doesNotMatch(background,/executeScript\([^)]*func:\s*new Function/);
});

test("pairing and session tokens are stored only as hashes server-side",()=>{
  assert.match(migration,/pair_token_sha256 text not null/i);
  assert.match(migration,/session_token_sha256 text/i);
  assert.doesNotMatch(migration,/pair_token\s+text/i);
  assert.doesNotMatch(migration,/session_token\s+text/i);
  assert.match(edge,/sha256Hex/);
});

test("personal browser sessions and commands are service-role controlled and expire",()=>{
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all on table public\.hercules_personal_browser_sessions from public, anon, authenticated/i);
  assert.match(migration,/revoke all on table public\.hercules_personal_browser_commands from public, anon, authenticated/i);
  assert.match(migration,/expires_at/i);
  assert.match(migration,/status in \('waiting','connected','closed','expired'\)/i);
});

test("service-role command submitter only targets an explicitly connected unexpired session",()=>{
  assert.match(migration,/create or replace function public\.hercules_personal_browser_command_submit/i);
  assert.match(migration,/s\.status\s*=\s*'connected'/i);
  assert.match(migration,/s\.expires_at\s*>\s*now\(\)/i);
  assert.match(migration,/grant execute on function public\.hercules_personal_browser_command_submit/i);
  assert.match(migration,/to service_role/i);
});

test("extension never exports cookies passwords session tokens or one-time codes",()=>{
  assert.doesNotMatch(background,/document\.cookie/);
  assert.doesNotMatch(background,/localStorage/);
  assert.doesNotMatch(background,/sessionStorage/);
  assert.doesNotMatch(background,/\.value\s*[,}]/);
  assert.match(edge,/credential_export_forbidden/);
});

const privateBridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");

test("personal browser protocol is multiplexed through the existing private bridge slot",()=>{
  assert.match(privateBridge,/handlePersonalBrowserRequest/);
  assert.match(privateBridge,/isPersonalBrowserAction/);
  assert.match(privateBridge,/if\(isPersonalBrowserAction\(probeAction\)\)return handlePersonalBrowserRequest\(req\)/);
  assert.match(background,/hercules-private-bridge/);
});


const integrations=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("pairing UI and extension use the multiplexed private bridge protocol",()=>{
  assert.match(background,/functions\/v1\/hercules-private-bridge/);
  assert.match(background,/action:"personal_browser_connect"/);
  assert.doesNotMatch(background,/action:"connect"/);
  assert.match(integrations,/hercules-private-bridge/);
  assert.match(integrations,/personal_browser_owner_status/);
  assert.match(integrations,/personal_browser_create_pair/);
  assert.doesNotMatch(integrations,/hercules-personal-browser-bridge/);
});

test("personal browser observations strip URL query strings and fragments",()=>{
  assert.match(background,/function safeUrl\(/);
  assert.match(background,/return u\.origin\+u\.pathname/);
  assert.doesNotMatch(background,/href:a\.href/);
  assert.doesNotMatch(background,/url:location\.href/);
});

test("injected DOM action carries its own URL sanitizer without relying on extension closures",()=>{
  const start=background.indexOf("function domAction");
  const end=background.indexOf("async function executeCommand",start);
  const block=background.slice(start,end);
  assert.match(block,/const safePageUrl=/);
  assert.match(block,/href:safePageUrl\(a\.href\)/);
  assert.match(block,/url:safePageUrl\(location\.href\)/);
});
