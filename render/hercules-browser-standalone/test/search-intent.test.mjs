import test from "node:test";
import assert from "node:assert/strict";
import {resolveHerculesInput} from "../public/search-intent.mjs";

test("searches natural language rather than treating it as a URL",()=>{
 assert.equal(resolveHerculesInput("best wholesale hoodie suppliers"),"https://www.google.com/search?q=best%20wholesale%20hoodie%20suppliers");
});
test("preserves explicitly supplied HTTPS URLs",()=>{
 assert.equal(resolveHerculesInput("https://example.com/path?q=1"),"https://example.com/path?q=1");
});
test("supports ordinary domains",()=>{
 assert.equal(resolveHerculesInput("example.com"),"https://example.com/");
});
test("does not navigate unsafe schemes",()=>{
 assert.throws(()=>resolveHerculesInput("javascript:alert(1)"),/unsupported/i);
});
test("rejects blank input",()=>{
 assert.throws(()=>resolveHerculesInput("   "),/empty/i);
});
