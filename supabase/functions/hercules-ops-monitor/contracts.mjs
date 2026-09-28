export const DAY_MS=24*60*60*1000;

function is2xx(status){
  return Number.isInteger(status)&&status>=200&&status<300;
}

function parseTime(value){
  const ms=Date.parse(String(value||""));
  return Number.isFinite(ms)?ms:null;
}

function result(ok,reachability_ok,functional_ok,freshness_ok,verification_level,reason=null){
  return {ok:Boolean(ok),reachability_ok:Boolean(reachability_ok),functional_ok,freshness_ok,verification_level,reason};
}

export function evaluateMonitorContract({
  expected="json-ok",
  status=null,
  contentType="",
  body=null,
  text="",
  serviceSlug="",
  nowMs=Date.now(),
  maxAgeMs=DAY_MS
}={}){
  const json=String(contentType||"").toLowerCase().includes("application/json");
  const reachability=status!==null&&status!==undefined;

  if(expected==="auth-or-json-health"){
    if(status===401||status===403){
      return result(true,true,null,null,"reachability_only","protected_endpoint_reachable");
    }
    const functional=is2xx(status)&&json&&body&&typeof body==="object"&&body.ok!==false;
    return result(functional,reachability,functional,null,functional?"functional":"failed",functional?null:"json_health_failed");
  }

  if(expected==="public-launch-contract"){
    const functional=is2xx(status)&&json&&body&&typeof body==="object"&&
      body.ok!==false&&body.service==="hercules-launch"&&
      body.controlled_pilot_open===true&&
      body.paid_billing_active===false&&
      body.public_account_registration_open===false;
    return result(functional,reachability,functional,null,functional?"functional":"failed",functional?null:"launch_contract_mismatch");
  }

  if(expected==="launch-page-contract"){
    const page=String(text||"");
    const markers=[
      "Hercules Revenue Recovery by SauceApproved",
      "Founding Pilot applications are open.",
      "Paid billing and general public account creation remain closed."
    ];
    const functional=is2xx(status)&&!json&&markers.every(marker=>page.includes(marker));
    return result(functional,reachability,functional,null,functional?"functional":"failed",functional?null:"launch_page_contract_mismatch");
  }

  if(expected==="devbrain-freshness"){
    const checkedAt=parseTime(body?.lastCheck?.checked_at);
    const functional=is2xx(status)&&json&&body?.ok===true&&
      body?.service==="hercules-devbrain-fabric"&&
      body?.lastCheck?.overall_ok===true;
    const freshness=checkedAt!==null&&checkedAt<=nowMs&&nowMs-checkedAt<=maxAgeMs;
    const ok=functional&&freshness;
    return result(ok,reachability,functional,freshness,ok?"functional_fresh":"failed",
      !functional?"devbrain_functional_check_failed":!freshness?"devbrain_evidence_stale":null);
  }

  if(expected==="internal-json-health"){
    const functional=is2xx(status)&&json&&body&&typeof body==="object"&&body.ok===true&&
      (!serviceSlug||body.service===serviceSlug);
    return result(functional,reachability,functional,null,functional?"authenticated_functional":"failed",
      functional?null:"internal_health_contract_failed");
  }

  const functional=is2xx(status)&&json&&body&&typeof body==="object"&&body.ok!==false;
  return result(functional,reachability,functional,null,functional?"functional":"failed",functional?null:"json_health_failed");
}
