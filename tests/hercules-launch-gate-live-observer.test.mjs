import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateLaunchGateSnapshot, observeLaunchGate} from '../scripts/hercules-launch-gate-live-observer.mjs';

const now = Date.parse('2026-10-13T12:00:00.000Z');
const fresh = {
  ok:true, service:'hercules-launch-gate',
  lastCheck:{checked_at:'2026-10-13T11:55:00.000Z',technical_ok:true,commercial_ok:false,launch_ready:false},
  publicRegistrationOpen:false,
};

test('fresh closed release is operational and remains held',()=>{
  const result=evaluateLaunchGateSnapshot(fresh,{now});
  assert.equal(result.ok,true);
  assert.equal(result.publicRelease,'held');
  assert.equal(result.readiness,'blocked');
  assert.deepEqual(result.blockers,[]);
});

test('fresh readiness cannot itself open public release',()=>{
  const result=evaluateLaunchGateSnapshot({...fresh,lastCheck:{...fresh.lastCheck,launch_ready:true,commercial_ok:true}},{now});
  assert.equal(result.ok,true);
  assert.equal(result.publicRelease,'held');
  assert.equal(result.readiness,'ready');
});

test('stale gate record fails closed, even when historical readiness was true',()=>{
  const result=evaluateLaunchGateSnapshot({...fresh,lastCheck:{...fresh.lastCheck,checked_at:'2026-09-30 19:32:02.808893+00',launch_ready:true}},{now});
  assert.equal(result.ok,false);
  assert.ok(result.blockers.includes('launch_gate_check_stale'));
  assert.equal(result.readiness,'unverified');
});

test('public registration active with a non-ready gate is flagged',()=>{
  const result=evaluateLaunchGateSnapshot({...fresh,publicRegistrationOpen:true},{now});
  assert.equal(result.ok,false);
  assert.ok(result.blockers.includes('public_registration_without_readiness'));
  assert.equal(result.publicRelease,'unverified');
});

test('unknown or malformed snapshot fails closed',()=>{
  for(const candidate of [null,{},[],{...fresh,ok:false},{...fresh,lastCheck:null},{...fresh,service:'other'},{...fresh,publicRegistrationOpen:'false'},
    {...fresh,lastCheck:{...fresh.lastCheck,checked_at:'not-time'}},
    {...fresh,lastCheck:{...fresh.lastCheck,checked_at:'2026-10-13T12:02:00.000Z'}}]){
    assert.equal(evaluateLaunchGateSnapshot(candidate,{now}).ok,false);
  }
});

test('live observer fetches only fixed owned read-only GET endpoint; never POSTs',async()=>{
  let captured;
  const result=await observeLaunchGate({now,fetchImpl:async(url,options)=>{
    captured={url,options};
    return {ok:true,status:200,json:async()=>fresh};
  }});
  assert.equal(result.ok,true);
  assert.equal(captured.options.method,'GET');
  assert.match(captured.url,/^https:\/\/xbwuablxhhwsaoomsoco\.supabase\.co\/functions\/v1\/hercules-launch-gate$/);
  assert.equal(captured.options.headers.authorization,undefined);
});

test('network and HTTP failures return sanitized fail-closed results',async()=>{
  for(const fetchImpl of [async()=>{throw new Error('SECRET=never-print-me')},async()=>({ok:false,status:403})]){
    const result=await observeLaunchGate({now,fetchImpl});
    assert.equal(result.ok,false);
    assert.equal(JSON.stringify(result).includes('never-print-me'),false);
  }
});

test('inconsistent ready=true despite failed commercial or technical check is rejected',()=>{
  const lastCheck={...fresh.lastCheck,launch_ready:true};
  const result=evaluateLaunchGateSnapshot({...fresh,lastCheck},{now});
  assert.equal(result.ok,false);
  assert.ok(result.blockers.includes('launch_gate_inconsistent_readiness'));
});

test('public release workflow enforces freshness before evidence admission',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/hercules-release-gate-v1.yml',import.meta.url),'utf8');
  assert.match(workflow,/name: Verify live Hercules launch-gate freshness/);
  assert.match(workflow,/node scripts\/hercules-launch-gate-live-observer\.mjs/);
});

test('live observer has scheduled read-only runs',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/hercules-launch-gate-live-watch.yml',import.meta.url),'utf8');
  assert.match(workflow,/schedule:/);
  assert.match(workflow,/cron:/);
  assert.match(workflow,/node scripts\/hercules-launch-gate-live-observer\.mjs/);
  assert.match(workflow,/event_name != 'pull_request'/);
});
