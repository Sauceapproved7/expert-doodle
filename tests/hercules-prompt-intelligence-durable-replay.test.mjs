import test from 'node:test';
import assert from 'node:assert/strict';
import {createDurableReplayClaim} from '../hercules-runtime/prompt-intelligence/durable-replay.mjs';

test('claim forwards validated source and sequence to the dedicated RPC', async () => {
  const calls = [];
  const claim = createDurableReplayClaim({rpc: async (name, args) => {calls.push({name,args}); return true;}});
  assert.equal(await claim('smallz', 15), true);
  assert.deepEqual(calls, [{name:'hercules_prompt_trace_claim_sequence', args:{p_source:'smallz',p_sequence:15}}]);
});
test('replayed and out-of-order claims are denied', async () => {
  let last = 0;
  const claim = createDurableReplayClaim({rpc:async (_name,args)=> args.p_sequence>last ? (last=args.p_sequence,true) : false});
  assert.equal(await claim('smallz',3), true);
  assert.equal(await claim('smallz',3), false);
  assert.equal(await claim('smallz',2), false);
});
test('invalid identity or counter never reaches the RPC', async () => {
  let calls=0;
  const claim=createDurableReplayClaim({rpc:async()=>{calls++; return true;}});
  for(const [source,seq] of [['../../bad',1],['',1],['smallz',0],['smallz',1.5],['smallz',Number.MAX_SAFE_INTEGER+1]]) {
    await assert.rejects(claim(source,seq),/invalid_replay_claim/);
  }
  assert.equal(calls,0);
});
test('transport failures and ambiguous RPC responses fail closed', async () => {
  for(const response of [undefined,null,0,1,'true',{ok:true},[true]]) {
    const claim=createDurableReplayClaim({rpc:async()=>response});
    await assert.rejects(claim('smallz',1),/invalid_replay_response/);
  }
  const claim=createDurableReplayClaim({rpc:async()=>{throw new Error('transport_failed');}});
  await assert.rejects(claim('smallz',1),/transport_failed/);
});
test('missing RPC is invalid', () => {
  assert.throws(()=>createDurableReplayClaim({}),/rpc_required/);
});
