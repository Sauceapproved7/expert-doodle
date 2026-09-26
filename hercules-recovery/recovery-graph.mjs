import {createHash} from "node:crypto";

const KNOWN_TYPES=new Set(["INVOICE_PAID","PROMISE_MADE","PROMISE_BROKEN","DISPUTE_OPENED","DISPUTE_RESOLVED","CONTACT_RESPONSE","CONTACT_NO_RESPONSE"]);

function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
function sha(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");}
function validDate(v){return typeof v==="string"&&!Number.isNaN(Date.parse(v));}

export function buildRecoveryGraph(input){
  if(!input||typeof input!=="object"||typeof input.accountId!=="string"||!input.accountId.trim())throw new TypeError("accountId is required");
  if(!Array.isArray(input.events))throw new TypeError("events must be an array");
  const seen=new Set();
  const events=input.events.map(event=>{
    if(!event||typeof event.eventId!=="string"||!event.eventId.trim())throw new TypeError("eventId is required");
    if(seen.has(event.eventId))throw new Error("duplicate eventId");
    seen.add(event.eventId);
    if(!KNOWN_TYPES.has(event.type))throw new TypeError("unsupported recovery event type");
    if(!validDate(event.occurredAt))throw new TypeError("occurredAt must be an ISO-compatible timestamp");
    return Object.freeze({...event,verified:event.verified===true});
  }).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.eventId.localeCompare(b.eventId));

  const verified=events.filter(e=>e.verified);
  const unverified=events.filter(e=>!e.verified);
  const brokenPromiseCount=verified.filter(e=>e.type==="PROMISE_BROKEN").length;
  const paid=verified.filter(e=>e.type==="INVOICE_PAID");
  const avgPaidDaysAfterDue=paid.length?Number((paid.reduce((n,e)=>n+(Number.isFinite(e.daysAfterDue)?e.daysAfterDue:0),0)/paid.length).toFixed(2)):null;

  let openDisputes=0;
  for(const e of verified){if(e.type==="DISPUTE_OPENED")openDisputes++;if(e.type==="DISPUTE_RESOLVED")openDisputes=Math.max(0,openDisputes-1);}

  const reasons=[];
  if(brokenPromiseCount)reasons.push("VERIFIED_BROKEN_PROMISE_HISTORY");
  if(openDisputes)reasons.push("OPEN_DISPUTE_HISTORY");
  if(paid.length)reasons.push("VERIFIED_PAYMENT_HISTORY");
  if(unverified.length)reasons.push("UNVERIFIED_OBSERVATIONS_PRESENT");

  const evidence={accountId:input.accountId,events:events.map(e=>({...e}))};
  return Object.freeze({
    schema:"hercules.recovery.graph.v1",
    accountId:input.accountId,
    evidenceSha256:sha(evidence),
    metrics:Object.freeze({
      verifiedEventCount:verified.length,
      unverifiedEventCount:unverified.length,
      paidInvoiceCount:paid.length,
      brokenPromiseCount,
      openDisputeCount:openDisputes,
      averageVerifiedPaidDaysAfterDue:avgPaidDaysAfterDue,
    }),
    reasonCodes:Object.freeze(reasons),
    guardrails:Object.freeze({
      escalationAllowed:false,
      adverseDecisionEvidenceSufficient:false,
      requiresCurrentInvoiceAssessment:true,
      unverifiedEventsMayDriveAdverseAction:false,
    }),
    timeline:Object.freeze(events),
  });
}
