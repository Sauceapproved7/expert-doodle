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

test("signup checks password safety before Supabase signUp",()=>{
  const check=source.indexOf("password_breach_check");
  const signUp=source.indexOf("sb.auth.signUp");
  assert.ok(check>=0);
  assert.ok(signUp>=0);
  assert.match(source,/checkPasswordSafety\(password\)/);
  assert.ok(source.indexOf("checkPasswordSafety(password)")<signUp);
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
