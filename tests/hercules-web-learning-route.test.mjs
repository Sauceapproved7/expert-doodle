import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../supabase/functions/hercules-web/index.ts",import.meta.url),"utf8");

test("hercules-web exposes the Learning Adventure route without weakening the main app",()=>{
  assert.match(source,/\/learning-adventure/);
  assert.match(source,/Hercules Learning Adventure/);
  assert.match(source,/No child email, location, open chat, ads, or purchases/);
  assert.match(source,/localStorage/);
  assert.match(source,/connect-src 'none'/);
  assert.match(source,/payment=\(\)/);
  assert.match(source,/q\.pathname.*learning-adventure/);
});

test("Learning Adventure route remains GET-only",()=>{
  assert.match(source,/method_not_allowed/);
  assert.match(source,/req\.method.*GET/);
});
