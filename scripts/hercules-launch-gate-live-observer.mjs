import {fileURLToPath} from 'node:url';
import path from 'node:path';

// This endpoint exposes existing read-only launch-gate status. It is not the
// authenticated POST that computes a new gate check.
const GATE_STATUS_URL='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch-gate';
const MAX_AGE_MS=30*60*1000;
const FUTURE_SKEW_MS=60*1000;
const REQUEST_TIMEOUT_MS=10_000;

export function evaluateLaunchGateSnapshot(snapshot,{now=Date.now()}={}){
  const blockers=[];
  const valid=!!snapshot && typeof snapshot==='object' && !Array.isArray(snapshot);
  if(!valid || snapshot.ok!==true || snapshot.service!=='hercules-launch-gate'){
    blockers.push('launch_gate_response_invalid');
  }
  const last=valid && snapshot.lastCheck && typeof snapshot.lastCheck==='object' &&
    !Array.isArray(snapshot.lastCheck) ? snapshot.lastCheck : null;
  const checkedAt=last?.checked_at;
  const checkedTime=typeof checkedAt==='string'?Date.parse(checkedAt):NaN;
  const instant=Number(now);
  const fresh=Number.isFinite(checkedTime) && Number.isFinite(instant) &&
    checkedTime<=instant+FUTURE_SKEW_MS && instant-checkedTime<=MAX_AGE_MS;
  if(!fresh){blockers.push('launch_gate_check_stale');}
  if(!last || typeof last.launch_ready!=='boolean' || typeof last.technical_ok!=='boolean' ||
    typeof last.commercial_ok!=='boolean'){
    blockers.push('launch_gate_evidence_invalid');
  }
  if(last?.launch_ready===true && (last.technical_ok!==true || last.commercial_ok!==true)){
    blockers.push('launch_gate_inconsistent_readiness');
  }
  if(!valid || typeof snapshot.publicRegistrationOpen!=='boolean'){
    blockers.push('public_registration_state_unknown');
  }
  if(valid && snapshot.publicRegistrationOpen===true && (!fresh || last?.launch_ready!==true)){
    blockers.push('public_registration_without_readiness');
  }
  const ok=blockers.length===0;
  return {
    schema:'sauceapproved.hercules.launch-gate-live-observation',
    version:1,
    ok,
    checkedAt:typeof checkedAt==='string'?checkedAt:null,
    readiness:ok?(last.launch_ready===true?'ready':'blocked'):'unverified',
    publicRelease:ok?(snapshot.publicRegistrationOpen?'open':'held'):'unverified',
    blockers,
  };
}

export async function observeLaunchGate({now=Date.now(),fetchImpl=globalThis.fetch}={}){
  try{
    const response=await fetchImpl(GATE_STATUS_URL,{
      method:'GET',
      headers:{accept:'application/json','cache-control':'no-cache'},
      redirect:'error',
      signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if(!response.ok){
      return {
        schema:'sauceapproved.hercules.launch-gate-live-observation',
        version:1,ok:false,checkedAt:null,readiness:'unverified',publicRelease:'unverified',
        blockers:['launch_gate_http_unavailable'],
      };
    }
    return evaluateLaunchGateSnapshot(await response.json(),{now});
  }catch{
    // Never expose remote payload, headers, environment variables or errors in logs.
    return {
      schema:'sauceapproved.hercules.launch-gate-live-observation',
      version:1,ok:false,checkedAt:null,readiness:'unverified',publicRelease:'unverified',
      blockers:['launch_gate_request_failed'],
    };
  }
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const observation=await observeLaunchGate();
  process.stdout.write(JSON.stringify(observation,null,2)+'\n');
  if(!observation.ok)process.exitCode=1;
}
