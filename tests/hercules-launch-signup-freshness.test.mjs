import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");

test("signup API rejects stale launch readiness before screening passwords or creating users",()=>{
  assert.match(source,/function freshRegistrationReadiness\(/);
  assert.match(source,/Number\.isFinite\(timestamp\)/);
  assert.match(source,/timestamp\s*>=\s*now\s*-\s*30\s*\*\s*60\s*\*\s*1000/);
  assert.match(source,/timestamp\s*<=\s*now\s*\+\s*60\s*\*\s*1000/);
  const api=source.slice(source.indexOf("async function serverRegistrationOpen()"),source.indexOf("async function secureSignup("));
  assert.match(api,/freshRegistrationReadiness\(d\?\.lastCheck\)/);
  assert.match(api,/d\?\.publicRegistrationOpen===true/);
  assert.match(api,/lastCheck\?\.launch_ready===true/);
});

test("public browser create account control uses same bounded readiness age",()=>{
  assert.match(source,/function freshPublicRegistrationCheck\(/);
  assert.match(source,/Number\.isFinite\(t\)/);
  assert.match(source,/t\s*>=\s*now\s*-\s*30\s*\*\s*60\s*\*\s*1000/);
  assert.match(source,/t\s*<=\s*now\s*\+\s*60\s*\*\s*1000/);
  const ui=source.slice(source.indexOf("async function refreshRegistrationState()"),source.indexOf("async function openProduct()"));
  assert.match(ui,/freshPublicRegistrationCheck\(d\?\.lastCheck\)/);
  assert.match(ui,/d\?\.publicRegistrationOpen===true/);
  assert.match(ui,/lastCheck\?\.launch_ready===true/);
});

test("new registration still uses password defense, existing sign-in unchanged",()=>{
  assert.match(source,/async function secureSignup\(email:string,password:string\)/);
  assert.match(source,/if\(!await serverRegistrationOpen\(\)\)/);
  assert.match(source,/screenPasswordServer\(password\)/);
  assert.match(source,/issuePasswordTicket\("signup",email,null\)/);
  assert.match(source,/Early access — sign-in only/);
  assert.match(source,/Existing authorized users can sign in/);
});
