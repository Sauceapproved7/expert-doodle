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

test("allows privacy-oriented DuckDuckGo search without credentials",()=>{
 assert.equal(resolveHerculesInput("hoodie supplier", "duckduckgo"),"https://duckduckgo.com/?q=hoodie%20supplier");
});
test("does not accept arbitrary provider URL injection",()=>{
 assert.throws(()=>resolveHerculesInput("hoodie supplier", "https://evil.example"),/unsupported search provider/i);
});

test("search treats localhost with spaces as a query",()=>{
 assert.equal(resolveHerculesInput("localhost setup"),"https://www.google.com/search?q=localhost%20setup");
});
test("rejects malformed explicit URLs",()=>{
 assert.throws(()=>resolveHerculesInput("https://"),/invalid url/i);
});
test("blocks embedded URL credentials",()=>{
 assert.throws(()=>resolveHerculesInput("https://user:password@example.com"),/credentials/i);
});

test("does not misclassify colon-containing research queries as URL schemes",()=>{
 assert.equal(resolveHerculesInput("pricing: free hosting"),"https://www.google.com/search?q=pricing%3A%20free%20hosting");
});
test("does not misclassify a URL-looking question as a domain",()=>{
 assert.equal(resolveHerculesInput("example.com alternatives"),"https://www.google.com/search?q=example.com%20alternatives");
});

test("rejects protocol-relative URLs rather than silently navigating",()=>{
 assert.throws(()=>resolveHerculesInput("//example.com"),/unsupported/i);
});
test("rejects backslash-prefixed URL ambiguity",()=>{
 assert.throws(()=>resolveHerculesInput("\\\\example.com"),/unsupported/i);
});
