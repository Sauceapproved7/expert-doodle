/**
 * Hercules Runtime Witness v1: bounded, read-only public HTML observation.
 * A public 200 response proves neither deployment identity nor application health.
 * Never handles tokens, customer input, payment actions, deployments or approvals.
 */
const TARGETS=Object.freeze({
  'smallz-launch':'https://smallz-hercules.onrender.com/launch',
  'studio-activation':'https://sauceapproved-studio.onrender.com/activate',
});
const MAX_PREFIX_BYTES=16_384;
const TIMEOUT_MS=4_000;
const MAX_SAMPLES=5;

export function listWitnessTargets(){return {...TARGETS};}

export function summarizeWitnessSamples(values){
  if(!Array.isArray(values)||values.some(n=>!Number.isFinite(n)||n<0)) throw new TypeError('invalid_latency_samples');
  const sorted=[...values].sort((a,b)=>a-b);
  if(!sorted.length) return {p50Ms:null,p95Ms:null,maxMs:null,observations:0};
  const percentile=(p)=>sorted[Math.ceil(p*sorted.length)-1];
  return {p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:sorted.at(-1),observations:sorted.length};
}

async function readHtmlPrefix(body){
  if(!body || typeof body.getReader!=='function') return false;
  const reader=body.getReader();
  let remaining=MAX_PREFIX_BYTES;
  const fragments=[];
  try{
    while(remaining>0){
      const {value,done}=await reader.read();
      if(done) break;
      if(!(value instanceof Uint8Array)) return false;
      const view=value.subarray(0,remaining);
      fragments.push(new TextDecoder().decode(view));
      remaining-=view.byteLength;
      if(value.byteLength>view.byteLength) break;
    }
  }finally{
    try{await reader.cancel()}catch{/* no output/authority from cancellation failure */}
  }
  const prefix=fragments.join('').trim();
  return /(?:<!doctype\s+html|<html(?:\s|>))/iu.test(prefix);
}

async function oneSample(url,fetchImpl,clock,number){
  const start=clock();
  let result='not_reachable',reason='request_failed',status=null;
  try{
    const response=await fetchImpl(url,{
      method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',
      referrerPolicy:'no-referrer',headers:{accept:'text/html'},
      signal:AbortSignal.timeout(TIMEOUT_MS),
    });
    status=Number.isInteger(response?.status)?response.status:null;
    if(status!==200 || response.redirected===true){reason='unexpected_http_status';}
    else if(!/^text\/html(?:\s*;|\s*$)/iu.test(response.headers?.get('content-type')??'')){reason='unexpected_content_type';}
    else if(!await readHtmlPrefix(response.body)){reason='invalid_html_prefix';}
    else{result='html_reachable';reason='public_html_observed';}
  }catch{/* Never expose exception text or remote body; may contain secrets. */}
  const elapsed=clock()-start;
  const latencyMs=Number.isFinite(elapsed)&&elapsed>=0?Math.round(elapsed*100)/100:null;
  return {attempt:number,result,reason,status,latencyMs};
}

export function probePublicWitness({target,samples=3,fetchImpl=fetch,clock=()=>performance.now()}={}){
  if(!Object.hasOwn(TARGETS,target)) throw new TypeError('unsupported_target');
  if(!Number.isInteger(samples)||samples<1||samples>MAX_SAMPLES) throw new TypeError('invalid_samples');
  if(typeof fetchImpl!=='function'||typeof clock!=='function') throw new TypeError('invalid_probe_dependencies');
  return (async()=>{
    const collected=[];
    for(let index=0;index<samples;index++){
      collected.push(await oneSample(TARGETS[target],fetchImpl,clock,index+1));
    }
    const successCount=collected.filter(x=>x.result==='html_reachable').length;
    const allSamplesPassed=successCount===samples;
    const recoveryObserved=collected.some((x,i)=>x.result!=='html_reachable'&&collected.slice(i+1).some(y=>y.result==='html_reachable'));
    const latency=summarizeWitnessSamples(collected.map(x=>x.latencyMs).filter(x=>x!==null));
    return {
      schema:'sauceapproved.hercules.runtime-witness.v1',
      target,targetUrl:TARGETS[target],sampleCount:samples,
      samples:collected,latency,allSamplesPassed,
      publicHtmlReachability:allSamplesPassed?'observed':successCount?'mixed':'not_observed',
      recoveryObservation:recoveryObserved?'transient_recovery_observed':'not_observed',
      evidenceLevel:'public_html_only',
      deploymentIdentityVerified:false,productionHealthVerified:false,paymentFlowVerified:false,releaseEligible:false,
      authority:{deploy:false,payment:false,approval:false},
    };
  })();
}
