import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../supabase/functions/hercules-learning-adventure/index.ts",import.meta.url),"utf8");

test("learning adventure live edge is public, child-safe, and self-contained",()=>{
  assert.match(source,/Hercules Learning Adventure/);
  assert.match(source,/No child email, location, open chat, ads, or purchases/);
  assert.match(source,/localStorage/);
  assert.match(source,/Word Woods/);
  assert.match(source,/Number Nebula/);
  assert.match(source,/Discovery Bay/);
  assert.match(source,/Puzzle Peaks/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/SUPABASE_(SERVICE|SECRET|ANON)/);
});

test("learning adventure live edge serves bounded browser content with security headers",()=>{
  assert.match(source,/content-security-policy/i);
  assert.match(source,/default-src 'self'/);
  assert.match(source,/connect-src 'none'/);
  assert.match(source,/frame-ancestors 'none'/);
  assert.match(source,/x-content-type-options/i);
  assert.match(source,/referrer-policy/i);
  assert.match(source,/req\.method!==["']GET["']/);
});
