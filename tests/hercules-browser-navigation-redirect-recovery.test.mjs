import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const browser=await readFile(
  new URL("../supabase/functions/hercules-browser/index.ts",import.meta.url),
  "utf8"
);

test("operator browser recovers a redirect-destroyed navigation observation",()=>{
  assert.match(browser,/function transientNavigationContextFailure\(/);
  assert.match(browser,/execution context was destroyed/i);
  assert.match(browser,/navigation/i);
  assert.match(browser,/navigationRecoveryAttempts/);
  assert.match(browser,/navigationRecovered/);
  assert.match(browser,/action:"screenshot"/);
  assert.match(browser,/fullPage:false/);
  assert.match(browser,/persistSession:true/);
  assert.match(browser,/action:"scrape"/);
  assert.match(browser,/selectors:\[\]/);
});

test("redirect recovery does not classify provider security or authentication challenges as transient",()=>{
  const start=browser.indexOf("function transientNavigationContextFailure(");
  assert.notEqual(start,-1);
  const end=browser.indexOf("\n}",start);
  const matcher=browser.slice(start,end+2);
  assert.doesNotMatch(matcher,/captcha/i);
  assert.doesNotMatch(matcher,/cloudflare/i);
  assert.doesNotMatch(matcher,/mfa/i);
  assert.doesNotMatch(matcher,/login/i);
  assert.doesNotMatch(matcher,/unauthorized/i);
});
