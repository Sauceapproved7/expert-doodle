const CREDENTIAL_KEY_PATTERN=/(?:^|_)(?:secret|secretkey|secret_key|token|access_token|refresh_token|password|api_key|apikey|private_key|client_secret)(?:$|_)/i;

function objectLike(value){return value!==null&&typeof value==="object";}
function nonEmpty(value){return typeof value==="string"&&value.trim().length>0;}
function currency(value){return String(value??"").trim().toLowerCase();}
function integer(value){return Number.isSafeInteger(Number(value))?Number(value):null;}
function sameText(a,b){return String(a??"").trim()===String(b??"").trim();}

function assertCredentialFree(value,seen=new WeakSet()){
  if(!objectLike(value))return;
  if(seen.has(value))return;
  seen.add(value);
  for(const [key,nested] of Object.entries(value)){
    const normalized=String(key).replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
    if(CREDENTIAL_KEY_PATTERN.test(normalized))throw new Error("credential_shaped_input_rejected");
    assertCredentialFree(nested,seen);
  }
}

function freshObservation(observedAt,{now,maxAgeMs,maxFutureSkewMs}){
  const observed=new Date(observedAt);
  const current=now instanceof Date?now:new Date(now);
  if(Number.isNaN(observed.getTime())||Number.isNaN(current.getTime()))return false;
  const age=current.getTime()-observed.getTime();
  return age<=maxAgeMs&&age>=-maxFutureSkewMs;
}

function checkoutVerified({checkout,expected,accountId}){
  if(!objectLike(checkout))return false;
  return checkout.livemode===true &&
    sameText(checkout.accountId,accountId) &&
    nonEmpty(checkout.sessionId) &&
    String(checkout.status??"").trim().toLowerCase()==="complete" &&
    String(checkout.paymentStatus??"").trim().toLowerCase()==="paid" &&
    integer(checkout.amountTotal)===expected.amountCents &&
    currency(checkout.currency)===expected.currency &&
    nonEmpty(checkout.paymentIntentId) &&
    nonEmpty(checkout.chargeId) &&
    nonEmpty(checkout.balanceTransactionId);
}

function refundVerified({refund,checkout,expected,accountId,checkoutOk}){
  if(!checkoutOk||!objectLike(refund))return false;
  return refund.livemode===true &&
    sameText(refund.accountId,accountId) &&
    nonEmpty(refund.id) &&
    String(refund.status??"").trim().toLowerCase()==="succeeded" &&
    integer(refund.amount)===expected.amountCents &&
    currency(refund.currency)===expected.currency &&
    sameText(refund.paymentIntentId,checkout.paymentIntentId) &&
    sameText(refund.chargeId,checkout.chargeId);
}

function payoutStateVerified({balanceTransaction,checkout,expected,accountId,providerReady,checkoutOk}){
  if(!checkoutOk||!providerReady||!objectLike(balanceTransaction))return false;
  const availableOn=integer(balanceTransaction.availableOn);
  return balanceTransaction.livemode===true &&
    sameText(balanceTransaction.accountId,accountId) &&
    nonEmpty(balanceTransaction.id) &&
    sameText(balanceTransaction.id,checkout.balanceTransactionId) &&
    sameText(balanceTransaction.source,checkout.chargeId) &&
    String(balanceTransaction.type??"").trim().toLowerCase()==="charge" &&
    currency(balanceTransaction.currency)===expected.currency &&
    integer(balanceTransaction.amount)===expected.amountCents &&
    availableOn!==null && availableOn>0;
}

export function buildStripePaymentEvidenceSnapshot(observation={},options={}){
  if(!objectLike(observation)||Array.isArray(observation))throw new TypeError("stripe_observation_must_be_object");
  assertCredentialFree(observation);

  const now=options.now??new Date();
  const maxAgeMs=Number.isFinite(options.maxAgeMs)?Math.max(0,Number(options.maxAgeMs)):5*60*1000;
  const maxFutureSkewMs=Number.isFinite(options.maxFutureSkewMs)?Math.max(0,Number(options.maxFutureSkewMs)):60*1000;
  const expectedInput=objectLike(observation.expected)?observation.expected:{};
  const expected={
    accountId:String(expectedInput.accountId??"").trim(),
    amountCents:integer(expectedInput.amountCents),
    currency:currency(expectedInput.currency)
  };
  const account=objectLike(observation.account)?observation.account:{};
  const accountId=String(account.id??"").trim();
  const expectedValid=nonEmpty(expected.accountId)&&expected.amountCents!==null&&expected.amountCents>0&&/^[a-z]{3}$/.test(expected.currency);
  const liveAuthorized=Boolean(
    expectedValid&&account.livemode===true&&accountId===expected.accountId
  );
  const providerReady=Boolean(
    liveAuthorized&&account.chargesEnabled===true&&account.payoutsEnabled===true
  );
  const evidenceFresh=freshObservation(observation.observedAt,{now,maxAgeMs,maxFutureSkewMs});

  let checkout=false,refund=false,payout=false;
  if(evidenceFresh&&expectedValid&&liveAuthorized){
    checkout=checkoutVerified({checkout:observation.checkout,expected,accountId});
    refund=refundVerified({refund:observation.refund,checkout:observation.checkout,expected,accountId,checkoutOk:checkout});
    payout=payoutStateVerified({balanceTransaction:observation.balanceTransaction,checkout:observation.checkout,expected,accountId,providerReady,checkoutOk:checkout});
  }

  return {
    liveAuthorized,
    providerReady,
    evidenceFresh,
    provenance:observation.provenance??null,
    paymentProof:{checkout,refund,payout}
  };
}
