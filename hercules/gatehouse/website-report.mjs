/** Construct only private, withheld Gatehouse diagnostic rows after a signed domain-control challenge.
 * Caller MUST load siteRecord from owner-scoped trusted database query. This function makes no writes,
 * financial changes, customer delivery, or entitlement decisions.
 */
import {validateDomainChallenge} from "./domain-proof.mjs";
import {runVerifiedSiteDiagnostic} from "./website-diagnostic.mjs";
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CONSENT_AGE=30*86400000;
export async function buildWithheldSiteReport({siteRecord,requesterId,token,secret,organizationId,
 now=Date.now(),lookup,challengeRequest,headRequest}={}){
 const ts=Number(now);
 if(!siteRecord||typeof siteRecord!=="object"||!Number.isSafeInteger(ts)||ts<0
  ||typeof requesterId!=="string"||!UID.test(requesterId)
  ||!UID.test(siteRecord.id||"")||siteRecord.owner_user_id!==requesterId
  ||siteRecord.stage!=="awaiting-domain-control"
  ||siteRecord.consent_version!=="gatehouse-diagnostic-v1")
  throw new TypeError("Verified owner, consent and held site record required");
 const consent=Date.parse(siteRecord.authorized_at);
 if(!Number.isFinite(consent)||ts-consent>MAX_CONSENT_AGE||consent-ts>60_000)
  throw new TypeError("Site consent must be current");
 // Check signed hostname, org scope and expiry BEFORE any DNS resolution or outgoing network request.
 const claims=validateDomainChallenge({token,secret,organizationId,now:ts});
 if(siteRecord.origin!=="https://"+claims.hostname)
  throw new TypeError("Site record and signed challenge hostname differ");
 const observation=await runVerifiedSiteDiagnostic({
  token,secret,organizationId,now:ts,lookup,challengeRequest,headRequest
 });
 if(observation.domainControlObserved!==true||observation.site!==siteRecord.origin)
  throw new TypeError("Website control not established");
 // Limited, structured observations only, no raw IP, response headers, challenge, PII,
 // payment details or transport credentials. No confidence/health/security score invented.
 const summary={
  schema:"hercules.gatehouse.withheld-diagnostic.v1",
  status:"technical-observation-only",
  origin:siteRecord.origin,
  observed_at:observation.observedAt,
  domain_control_observed:true,
  method:"HTTPS HEAD /",
  http_status:observation.rootHttpStatus,
  http_class:observation.httpClass,
  header_presence:{...observation.headersObserved},
  findings:observation.findings,
  buyer_identity_verified:false,
  paid_order_verified:false,
  customer_identity_verified:false,
  customer_report_released:false,
  provider_attested:false,
  notice:"Single site observation after a valid challenge; not independent payment, buyer identity, uptime, website security, or delivered-customer-report proof."
 };
 if(Buffer.byteLength(JSON.stringify(summary),"utf8")>32000)throw new TypeError("Report too large");
 return {site_id:siteRecord.id,owner_user_id:requesterId,summary,delivery_state:"withheld"};
}
