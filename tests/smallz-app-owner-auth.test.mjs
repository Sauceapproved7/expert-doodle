import test from "node:test";
import assert from "node:assert/strict";
import {createSmallzRequestAuth} from "../hercules-bot/request-auth.mjs";
test("Smallz extracts owner bearer from request header without copying it into body",()=>{
 const a=createSmallzRequestAuth({authorization:"Bearer owner-session",body:{text:"open browser https://example.com"}});
 assert.equal(a.ownerAuthorization,"Bearer owner-session");
 assert.equal(JSON.stringify(a.body).includes("owner-session"),false);
});
test("Smallz request auth fails closed when bearer is missing",()=>{
 assert.throws(()=>createSmallzRequestAuth({authorization:"",body:{}}),/owner authorization required/);
});
