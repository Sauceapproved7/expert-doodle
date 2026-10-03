import {createHash} from 'node:crypto';

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

export function compareSnapshot(current, incoming) {
  const oldAt = current?.updatedAt == null ? null : Date.parse(current.updatedAt);
  const newAt = Date.parse(incoming?.updatedAt);
  if (!Number.isFinite(newAt) || (oldAt !== null && !Number.isFinite(oldAt))) throw new TypeError('snapshot_timestamp_invalid');
  if (!current) return 'apply';
  if (newAt < oldAt) return 'stale';
  if (newAt === oldAt && incoming.hash === current.hash) return 'unchanged';
  return 'apply';
}

export async function streamJsonl(body, onRecord, {maxBytes=536870912,maxLineBytes=1048576}={}) {
  if (!body?.getReader || typeof onRecord !== 'function') throw new TypeError('stream_arguments_invalid');
  const reader=body.getReader(), decoder=new TextDecoder('utf-8',{fatal:true}), digest=createHash('sha256');
  let buffer='', bytesSeen=0, recordsSeen=0;
  const consume=async raw=>{
    const line=raw.endsWith('\r')?raw.slice(0,-1):raw;
    if (!line.trim()) return;
    let value;
    try { value=JSON.parse(line); } catch { throw new Error('invalid_jsonl'); }
    await onRecord(value,recordsSeen+1);
    recordsSeen++;
  };
  try {
    for (;;) {
      const {value,done}=await reader.read();
      if (done) break;
      bytesSeen+=value.byteLength;
      if (bytesSeen>maxBytes) throw new Error('result_size_limit_exceeded');
      digest.update(value);
      try { buffer+=decoder.decode(value,{stream:true}); } catch { throw new Error('invalid_utf8'); }
      let pos;
      while ((pos=buffer.indexOf('\n'))!==-1) {
        const line=buffer.slice(0,pos);
        if (new TextEncoder().encode(line).byteLength>maxLineBytes) throw new Error('jsonl_line_limit_exceeded');
        buffer=buffer.slice(pos+1);
        await consume(line);
      }
      if (new TextEncoder().encode(buffer).byteLength>maxLineBytes) throw new Error('jsonl_line_limit_exceeded');
    }
    try { buffer+=decoder.decode(); } catch { throw new Error('invalid_utf8'); }
    if (new TextEncoder().encode(buffer).byteLength>maxLineBytes) throw new Error('jsonl_line_limit_exceeded');
    if (buffer.length) await consume(buffer);
    return {bytesSeen,recordsSeen,sha256:digest.digest('hex')};
  } catch (error) {
    await reader.cancel(error).catch(()=>{});
    throw error;
  } finally { reader.releaseLock(); }
}
