import test from "node:test";
import assert from "node:assert/strict";
import { executeAdminGraphqlRead } from "../shopify/hercules/backend/admin-graphql.mjs";

test("read transport returns GraphQL data without exposing token",async()=>{
 let seen;
 const fetchImpl=async(url,init)=>{seen={url,init};return new Response(JSON.stringify({data:{shop:{id:"gid://shopify/Shop/1"}},extensions:{cost:{requestedQueryCost:1,throttleStatus:{currentlyAvailable:999,restoreRate:50}}}}),{status:200,headers:{"content-type":"application/json"}})};
 const result=await executeAdminGraphqlRead({shop:"sauceapproved-2.myshopify.com",apiVersion:"2026-10",accessToken:"secret-token",query:"query { shop { id } }",fetchImpl,sleep:async()=>{}});
 assert.equal(result.shop.id,"gid://shopify/Shop/1");
 assert.equal(seen.init.headers["X-Shopify-Access-Token"],"secret-token");
 assert.equal(JSON.stringify(result).includes("secret-token"),false);
});

test("read transport retries throttled response with bounded delay",async()=>{
 let calls=0,slept=0;
 const fetchImpl=async()=>{calls++;return calls===1?new Response(JSON.stringify({errors:[{message:"Throttled",extensions:{code:"THROTTLED"}}]}),{status:200,headers:{"content-type":"application/json"}}):new Response(JSON.stringify({data:{shop:{id:"ok"}}}),{status:200,headers:{"content-type":"application/json"}})};
 const result=await executeAdminGraphqlRead({shop:"sauceapproved-2.myshopify.com",apiVersion:"2026-10",accessToken:"token",query:"query { shop { id } }",fetchImpl,sleep:async(ms)=>{slept=ms},maxRetries:2});
 assert.equal(result.shop.id,"ok"); assert.equal(calls,2); assert.ok(slept<=2000);
});

test("read transport rejects mutations before network",async()=>{
 let called=false;
 await assert.rejects(()=>executeAdminGraphqlRead({shop:"sauceapproved-2.myshopify.com",apiVersion:"2026-10",accessToken:"token",query:"mutation X { productCreate(product:{title:\"x\"}) { product { id } } }",fetchImpl:async()=>{called=true;}}),/read_only_graphql_required/);
 assert.equal(called,false);
});
