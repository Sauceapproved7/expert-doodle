import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");

test("signup uses a server-side compromised-password preflight",()=>{
  assert.match(source,/action==="password_breach_check"/);
  assert.match(source,/api\.pwnedpasswords\.com\/range\//);
  assert.match(source,/Add-Padding/);
  assert.match(source,/SHA-1/);
  assert.match(source,/compromised_password/);
  assert.match(source,/password_safety_unavailable/);
});

test("signup checks password safety before the server-enforced signup route",()=>{
  const check=source.indexOf("password_breach_check");
  const secureSignup=source.indexOf('action:"secure_signup"');
  assert.ok(check>=0);
  assert.ok(secureSignup>=0);
  assert.match(source,/checkPasswordSafety\(password\)/);
  assert.ok(source.indexOf("checkPasswordSafety(password)")<secureSignup);
  assert.doesNotMatch(source,/sb\.auth\.signUp\(\{email,password\}\)/);
});

test("signup password minimum is hardened to twelve characters",()=>{
  assert.match(source,/id="password"[^>]*minlength="12"/);
  assert.match(source,/password\.length<12/);
});

test("HIBP lookup sends only a five-character hash prefix",()=>{
  assert.match(source,/digest\.slice\(0,5\)/);
  assert.match(source,/digest\.slice\(5\)/);
  assert.doesNotMatch(source,/pwnedpasswords[^\n]{0,300}\+password/i);
});
