import test from 'node:test';
import assert from 'node:assert/strict';
import {createHerculesBotApp} from '../hercules-bot/app-server.mjs';
const env={RENDER:'true',RENDER_SERVICE_ID:'srv-db08fglg1s2s73d0o2rg',RENDER_GIT_REPO_SLUG:'Sauceapproved7/expert-doodle',RENDER_GIT_BRANCH:'main',RENDER_GIT_COMMIT:'a'.repeat(40),IS_PULL_REQUEST:'false'};
function boundary({authorize=true,healthy=true,state={emergencyStopClear:true,identityTrusted:true,auditTrusted:true}}={}){
  return {authenticateOwner:async()=>{if(!authorize)throw Object.assign(new Error('private'),{statusCode:401});return {id:'owner'};},
    readControlState:async()=>{if(!healthy)throw Error('private-control-error');return state}};
}
test('anonymous Smallz identity remains 401 and never reveals runtime metadata',async()=>{
  const app=createHerculesBotApp({renderEnv:env,boundary:boundary({authorize:false})});
  const response=await app.handle({method:'GET',url:'/api/runtime/identity'});
  assert.equal(response.status,401);
  assert.equal(JSON.stringify(response).includes(env.RENDER_GIT_COMMIT),false);
});
test('owner identity shows only exact validated Render metadata after external control read',async()=>{
  const app=createHerculesBotApp({renderEnv:env,boundary:boundary()});
  const response=await app.handle({method:'GET',url:'/api/runtime/identity',authorization:'Bearer TEST'});
  assert.equal(response.status,200);
  assert.equal(response.body.commitSha,env.RENDER_GIT_COMMIT);
  assert.equal(response.body.renderServiceId,env.RENDER_SERVICE_ID);
  assert.equal(response.body.productionHealthVerified,false);
  assert.equal(response.body.releaseApproved,false);
  assert.equal(JSON.stringify(response).includes('TEST'),false);
  assert.match(response.headers['cache-control'],/no-store/);
});
test('missing Render proof and absent external control fail closed without exposing details',async()=>{
  for(const params of [{renderEnv:{},boundary:boundary()},{renderEnv:env,boundary:boundary({healthy:false})},{renderEnv:env,boundary:boundary({state:{}})}]){
    const app=createHerculesBotApp(params);
    const response=await app.handle({method:'GET',url:'/api/runtime/identity',authorization:'Bearer TEST'});
    assert.equal(response.status,503);
    assert.equal(JSON.stringify(response).includes('private-control-error'),false);
    assert.equal(JSON.stringify(response).includes(env.RENDER_GIT_COMMIT),false);
  }
});
