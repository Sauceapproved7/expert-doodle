import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../supabase/functions/hercules-private-bridge/spaceship-mcp.ts',import.meta.url),'utf8');
const constants=source.match(/const RESOURCE_META=[\s\S]*?const SCOPE=/)[0].replace(/const SCOPE=$/,'');
const discovery=source.slice(source.indexOf('async function resourceMetadata()'),source.indexOf('async function row()'));
const oauth={issuer:'https://id.service.spaceship.com',authorization_endpoint:'https://id.service.spaceship.com/connect/authorize',token_endpoint:'https://id.service.spaceship.com/connect/token',registration_endpoint:'https://id.service.spaceship.com/connect/register'};

function discover(overrides={},resourceIssuer=oauth.issuer){
 const fetched=[];
 const context=vm.createContext({AbortSignal,fetch:async url=>{fetched.push(url);return {ok:true,json:async()=>url.includes('oauth-protected-resource')?{resource:'https://mcp.spaceship.com/',authorization_servers:[resourceIssuer]}:{...oauth,...overrides}}}});
 return {fetched,result:vm.runInContext(`${constants}\n${discovery}\nmetadata()`,context)};
}
test('accepts official October 12 Spaceship issuer metadata including issuer registration endpoint',async()=>{
 const x=discover();assert.equal((await x.result).oauth.registration_endpoint,oauth.registration_endpoint);
 assert.deepEqual(x.fetched,['https://mcp.spaceship.com/.well-known/oauth-protected-resource','https://id.service.spaceship.com/.well-known/oauth-authorization-server']);
});
for(const field of ['issuer','authorization_endpoint','token_endpoint','registration_endpoint']){
 test(`rejects untrusted ${field} without fetching it`,async()=>{
  const x=discover({[field]:'https://untrusted.example/endpoint'});await assert.rejects(x.result,/metadata_(mismatch|endpoint_mismatch)/);
  assert.ok(x.fetched.every(url=>!url.includes('untrusted.example')));
 });
}
test('rejects an untrusted resource issuer before authorization discovery',async()=>{
 const x=discover({},'https://untrusted.example');await assert.rejects(x.result,/issuer_untrusted/);assert.equal(x.fetched.length,1);
});
