import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ReadableStream} from 'node:stream/web';
import {streamJsonl, stableStringify, compareSnapshot} from '../supabase/functions/_shared/shopify-bulk-jsonl.mjs';

const bodyFrom = chunks => new ReadableStream({start(c){for(const x of chunks)c.enqueue(new TextEncoder().encode(x));c.close();}});

test('streams chunk-split JSONL, normalizes CRLF, and hashes exact bytes', async () => {
  const chunks=['{"id":"1"}\r','\n{"id":','"2"}\n'];
  const rows=[];
  const result=await streamJsonl(bodyFrom(chunks), async row=>rows.push(row));
  assert.deepEqual(rows,[{id:'1'},{id:'2'}]);
  assert.equal(result.recordsSeen,2);
  assert.equal(result.sha256,createHash('sha256').update(chunks.join('')).digest('hex'));
});

test('malformed JSON, invalid utf8, oversized lines and results fail closed', async () => {
  await assert.rejects(()=>streamJsonl(bodyFrom(['not-json']),async()=>{}),/invalid_jsonl/);
  await assert.rejects(()=>streamJsonl(bodyFrom(['12345']),async()=>{},{maxLineBytes:4}),/line_limit/);
  await assert.rejects(()=>streamJsonl(bodyFrom(['{"x":1}']),async()=>{},{maxBytes:3}),/result_size_limit/);
  const invalid=new ReadableStream({start(c){c.enqueue(new Uint8Array([0xff]));c.close();}});
  await assert.rejects(()=>streamJsonl(invalid,async()=>{}),/invalid_utf8/);
});

test('handler failure prevents stream success and stable serialization is key-order independent', async () => {
  await assert.rejects(()=>streamJsonl(bodyFrom(['{"id":1}']),async()=>{throw new Error('apply failed');}),/apply failed/);
  assert.equal(stableStringify({b:2,a:1}),stableStringify({a:1,b:2}));
});

test('snapshot comparison never applies an older record and skips identical versions', () => {
  const current={updatedAt:'2026-10-03T09:00:00.000Z',hash:'a'};
  assert.equal(compareSnapshot(current,{updatedAt:'2026-10-03T08:59:59Z',hash:'b'}),'stale');
  assert.equal(compareSnapshot(current,{updatedAt:'2026-10-03T09:00:00Z',hash:'a'}),'unchanged');
  assert.equal(compareSnapshot(current,{updatedAt:'2026-10-03T09:01:00Z',hash:'b'}),'apply');
});
