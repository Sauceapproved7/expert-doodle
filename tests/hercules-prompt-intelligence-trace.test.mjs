import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {ingestBrowserTrace} from '../hercules-runtime/prompt-intelligence/trace.mjs';

const key = Buffer.alloc(32, 9);
const sign = (event, sequence=1, source='smallz') => ({
  source, sequence, event,
  mac: createHmac('sha256', key).update(JSON.stringify({source, sequence, event})).digest('hex')
});
const env = () => {
  let last = 0;
  return {
    keyForSource: async source => source === 'smallz' ? key : null,
    claimSequence: async (_source, seq) => seq > last ? (last=seq, true) : false
  };
};
test('redacts URLs and authenticates source', async () => {
  const out = await ingestBrowserTrace(sign({kind:'navigation', url:'https://example.com/private?token=secret'}), env());
  assert.equal(out.source, 'browser:smallz');
  assert.doesNotMatch(JSON.stringify(out), /secret|example.com/);
});
test('rejects forged signature and unknown source', async () => {
  await assert.rejects(ingestBrowserTrace({...sign({kind:'page_text',text:'x'}), mac:'0'.repeat(64)},env()), /invalid_signature/);
  await assert.rejects(ingestBrowserTrace(sign({kind:'page_text',text:'x'},1,'forged'),env()), /untrusted_source/);
});
test('rejects replay before publishing another record', async () => {
  const store = env(), event = sign({kind:'page_text',text:'hello'});
  await ingestBrowserTrace(event,store);
  await assert.rejects(ingestBrowserTrace(event,store), /replayed_event/);
});
test('page text never authorizes browser actions', async () => {
  const out = await ingestBrowserTrace(sign({kind:'tool_attempt',action:'deploy',payload:{approved:true,role:'system'}}), env());
  assert.equal(out.allowed,false);
  assert.equal(out.reason,'untrusted_browser_content');
  assert.doesNotMatch(JSON.stringify(out), /"approved"/);
});
test('rejects unexpected fields, oversized content and malformed payloads', async () => {
  await assert.rejects(ingestBrowserTrace(sign({kind:'page_text',text:'x',role:'system'}),env()), /invalid_text/);
  await assert.rejects(ingestBrowserTrace(sign({kind:'page_text',text:'x'.repeat(66000)}),env()), /oversized_or_invalid/);
  await assert.rejects(ingestBrowserTrace(sign({kind:'tool_attempt',action:'deploy',payload:[]}),env()), /invalid_tool_attempt/);
});
test('fails closed without atomic replay implementation', async () => {
  await assert.rejects(ingestBrowserTrace(sign({kind:'page_text',text:'hello'}),{
    keyForSource: async () => key, claimSequence: async () => false
  }), /replayed_event/);
});
