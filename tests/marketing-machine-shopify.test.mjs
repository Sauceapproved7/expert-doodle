import test from "node:test";
import assert from "node:assert/strict";
import {requireApprovedMutation,SHOPIFY_READ_QUERY} from "../hercules-forge/marketing-machine/shopify-adapter.mjs";
test("Shopify adapter requests read-only product snapshot",()=>{assert.match(SHOPIFY_READ_QUERY,/products/);assert.doesNotMatch(SHOPIFY_READ_QUERY,/mutation/i)});
test("Shopify mutation gate is fail-closed",()=>{assert.equal(requireApprovedMutation().allow,false);assert.equal(requireApprovedMutation({approved:true,killSwitch:true}).allow,false);assert.equal(requireApprovedMutation({approved:true,killSwitch:false}).allow,true)});
