import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("launch source keeps the password-range line splitter valid for Edge deployment",async()=>{
  const source=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
  assert.match(source,/responseBody\.split\(\/\\r\?\\n\/\)/);
  assert.doesNotMatch(source,/responseBody\.split\(\/\\r\?\n\/\)/);
});
