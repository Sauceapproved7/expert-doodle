import test from "node:test";
import assert from "node:assert/strict";
import {normalizeBotWorkCommand} from "../hercules-bot/mcp-work-route.mjs";

test("Bot work route accepts bounded browser actions",()=>{
 assert.deepEqual(normalizeBotWorkCommand({action:"bot.browser.navigate",url:"https://example.com"}),{action:"bot.browser.navigate",url:"https://example.com/"});
 assert.deepEqual(normalizeBotWorkCommand({action:"bot.browser.scrape",url:"https://example.com/a"}),{action:"bot.browser.scrape",url:"https://example.com/a"});
});
test("Bot work route exposes deploy status but not production mutation",()=>{
 assert.deepEqual(normalizeBotWorkCommand({action:"bot.deploy.status"}),{action:"bot.deploy.status"});
 assert.throws(()=>normalizeBotWorkCommand({action:"bot.deploy.publish"}),/unsupported bot work action/);
});
test("Bot work route rejects credential-shaped payload fields",()=>{
 assert.throws(()=>normalizeBotWorkCommand({action:"bot.browser.navigate",url:"https://example.com",secret:"x"}),/credential field rejected/);
});
test("Bot work route rejects non-http browser URLs",()=>{
 assert.throws(()=>normalizeBotWorkCommand({action:"bot.browser.navigate",url:"file:\/\/\/etc\/passwd"}),/invalid browser url/);
});

test("Smallz verification lane is fixed to the production health canary",()=>{
 assert.deepEqual(normalizeBotWorkCommand({action:"smallz.verify.browser"}),{
  action:"smallz.verify.browser",
  url:"https://smallz-hercules.onrender.com/health",
  verificationOnly:true
 });
 assert.throws(()=>normalizeBotWorkCommand({action:"smallz.verify.browser",url:"https://example.com"}),/verification target is fixed/);
});


test("Smallz Shopify validation gate accepts only bounded Admin GraphQL validation requests",()=>{
 assert.deepEqual(normalizeBotWorkCommand({action:"smallz.validate.shopify",api:"admin",code:"query ShopName { shop { name } }",version:"2026-10"}),{
  action:"smallz.validate.shopify",api:"admin",code:"query ShopName { shop { name } }",version:"2026-10",validationRequired:true,validator:"shopify-ai-toolkit"
 });
 assert.throws(()=>normalizeBotWorkCommand({action:"smallz.validate.shopify",api:"unknown",code:"query { shop { name } }"}),/unsupported Shopify validator/);
 assert.throws(()=>normalizeBotWorkCommand({action:"smallz.validate.shopify",api:"admin",code:""}),/Shopify code required/);
 assert.throws(()=>normalizeBotWorkCommand({action:"smallz.validate.shopify",api:"admin",code:"query { shop { name } }",version:"latest"}),/invalid Shopify API version/);
});
