import test from 'node:test';
import assert from 'node:assert/strict';
import { listWitnessTargets, probePublicWitness, summarizeWitnessSamples } from '../hercules-runtime/runtime-witness.mjs';

const success = () => new Response('<!doctype html><html><title>Hercules</title><body>Ready</body></html>', {status:200,headers:{'content-type':'text/html; charset=utf-8'}});
const fail = (status=503) => new Response('unavailable', {status,headers:{'content-type':'text/plain'}});
const tick = () => {let n=0;return ()=>(n+=10)};

test('witness targets are fixed, exact public HTTPS page paths', () => {
  const targets=listWitnessTargets();
  assert.deepEqual(Object.keys(targets).sort(), ['smallz-launch','studio-activation']);
  assert.equal(targets['smallz-launch'], 'https://smallz-hercules.onrender.com/launch');
  assert.equal(targets['studio-activation'], 'https://sauceapproved-studio.onrender.com/activate');
  assert.throws(()=>probePublicWitness({target:'https://169.254.169.254/'}), /unsupported_target/);
});

test('observed HTML reachability is never release health or commercial verification', async () => {
  const calls=[];
  const report=await probePublicWitness({target:'smallz-launch',samples:3,fetchImpl:async(url,init)=>{calls.push({url,init});return success()}, clock:tick()});
  assert.equal(report.samples.length,3);
  assert.equal(report.allSamplesPassed,true);
  assert.equal(report.publicHtmlReachability,'observed');
  assert.equal(report.deploymentIdentityVerified,false);
  assert.equal(report.productionHealthVerified,false);
  assert.equal(report.paymentFlowVerified,false);
  assert.equal(report.releaseEligible,false);
  assert.equal(report.latency.p50Ms,10);
  assert.equal(report.latency.p95Ms,10);
  assert.ok(calls.every(c=>c.url==='https://smallz-hercules.onrender.com/launch'&&c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'));
  assert.deepEqual(report.authority,{deploy:false,payment:false,approval:false});
});

test('redirects and authentication failures do not pass the public HTML contract', async()=>{
  for(const response of [
    new Response(null,{status:302,headers:{location:'https://example.com/'}}),
    fail(401),
    new Response('  ',{status:200,headers:{'content-type':'text/html'}}),
    new Response('{"ok":true}',{status:200,headers:{'content-type':'application/json'}}),
  ]){
    const r=await probePublicWitness({target:'studio-activation',samples:1,fetchImpl:async()=>response,clock:tick()});
    assert.equal(r.allSamplesPassed,false);
    assert.equal(r.releaseEligible,false);
  }
});

test('failed requests followed by success are labeled transient, not durable recovery', async()=>{
  let i=0;const values=[fail(503),success(),success()];
  const r=await probePublicWitness({target:'smallz-launch',samples:3,fetchImpl:async()=>values[i++],clock:tick()});
  assert.equal(r.recoveryObservation,'transient_recovery_observed');
  assert.equal(r.allSamplesPassed,false);
  assert.equal(r.publicHtmlReachability,'mixed');
  assert.equal(r.samples[0].reason,'unexpected_http_status');
  assert.equal(r.samples[1].result,'html_reachable');
});

test('timeouts and fetch errors are sanitized without logging response bodies',async()=>{
  const r=await probePublicWitness({target:'smallz-launch',samples:1,fetchImpl:async()=>{throw new Error('sensitive-token=do-not-print')},clock:tick()});
  assert.equal(r.samples[0].reason,'request_failed');
  assert.equal(JSON.stringify(r).includes('sensitive-token'),false);
  assert.equal(r.allSamplesPassed,false);
});

test('strict input bounds and deterministic p95 avoid unbounded public traffic',()=>{
  for(const samples of [0,6,-1,1.5,NaN,'3']) assert.throws(()=>probePublicWitness({target:'smallz-launch',samples}), /invalid_samples/);
  const summary=summarizeWitnessSamples([9,1,4,100,3]);
  assert.deepEqual(summary,{p50Ms:4,p95Ms:100,maxMs:100,observations:5});
  assert.deepEqual(summarizeWitnessSamples([]),{p50Ms:null,p95Ms:null,maxMs:null,observations:0});
});

test('large HTML bodies are bounded and never returned to the caller',async()=>{
  const html='<!doctype html><html>'+('X'.repeat(150_000))+'</html>';
  const r=await probePublicWitness({target:'smallz-launch',samples:1,fetchImpl:async()=>new Response(html,{headers:{'content-type':'text/html'}}),clock:tick()});
  assert.equal(r.samples[0].result,'html_reachable');
  assert.equal(JSON.stringify(r).includes('XXXXX'),false);
});

// CLI invocation must not issue any network request without an explicit --probe.
test('CLI fails closed without probe consent or with arbitrary addresses',async()=>{
  const {spawnSync}=await import('node:child_process');
  const {fileURLToPath}=await import('node:url');
  const cli=fileURLToPath(new URL('../scripts/hercules-runtime-witness.mjs',import.meta.url));
  const missing=spawnSync(process.execPath,[cli,'--target','smallz-launch'],{encoding:'utf8'});
  assert.equal(missing.status,2);
  assert.match(missing.stderr,/explicit_probe_and_target_required/);
  const illegal=spawnSync(process.execPath,[cli,'--probe','--target','https://127.0.0.1/'],{encoding:'utf8'});
  assert.equal(illegal.status,2);
  assert.match(illegal.stderr,/unsupported_target/);
});
