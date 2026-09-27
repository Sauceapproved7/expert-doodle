import {createHash} from "node:crypto";
import {assessRecoveryCase} from "./recovery-core.mjs";
import {buildRecoveryGraph} from "./recovery-graph.mjs";
import {planRecoveryRoute} from "./recovery-route.mjs";

const SHA=/^[a-f0-9]{64}$/i;
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}

export function createRecoveryProductCase(input={}){
 const invoice=input.invoice??{};
 const assessment=assessRecoveryCase(invoice);
 const graph=buildRecoveryGraph({accountId:invoice.accountId,events:input.history??[]});
 const route=planRecoveryRoute({assessment,graph});
 const body=stable({
  schema:"hercules.revenue.recovery.product-case.v1",
  invoice:{invoiceId:invoice.invoiceId,accountId:invoice.accountId,amountCents:invoice.amountCents,daysOverdue:invoice.daysOverdue},
  state:assessment.state,
  priorityScore:assessment.priorityScore,
  confidence:assessment.confidence,
  safeToContact:assessment.safeToContact,
  route:route.route,
  requiresApproval:route.requiresApproval,
  reasonCodes:[...new Set([...(assessment.reasonCodes??[]),...(graph.reasonCodes??[]),...(route.reasonCodes??[])])].sort(),
  bindings:{assessmentSha256:assessment.evidenceSha256,graphSha256:graph.evidenceSha256},
  constraints:{sendsCommunication:false,performsEscalation:false,predictsRecovery:false,createsCreditScore:false},
  executionAuthority:false
 });
 return {...body,caseSha256:digest(body)};
}

export function verifyRecoveryProductCase(value={}){
 const {caseSha256,...body}=value;
 if(!SHA.test(caseSha256??""))return {valid:false,reason:"INVALID_DIGEST"};
 const calculatedSha256=digest(body),valid=calculatedSha256===caseSha256;
 return {valid,reason:valid?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256};
}
