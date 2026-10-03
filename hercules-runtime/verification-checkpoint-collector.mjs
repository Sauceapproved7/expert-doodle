import {routeVerificationEvidence} from "./verification-evidence-router.mjs";

function checkpoint({
  id,
  kind,
  evidenceFresh,
  provenance,
  ownerOnly=false,
  authorized=false,
  requestedAction="",
  providerReady=false,
  paymentProof=null
}){
  return {
    id,
    kind,
    evidenceFresh:evidenceFresh===true,
    provenance:provenance??null,
    ownerOnly:ownerOnly===true,
    authorized:authorized===true,
    requestedAction,
    providerReady:providerReady===true,
    paymentProof:paymentProof??null
  };
}

function paymentProofComplete(paymentProof){
  return paymentProof?.checkout===true &&
    paymentProof?.refund===true &&
    paymentProof?.payout===true;
}

export function collectVerificationCheckpoints(snapshot={}){
  if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot)){
    throw new TypeError("snapshot must be an object");
  }

  const checkpoints=[];

  if(snapshot.spaceship){
    const configured=String(snapshot.spaceship.status??"")==="configured";
    checkpoints.push(checkpoint({
      id:"DA-20",
      kind:"dns_authorization",
      evidenceFresh:snapshot.spaceship.evidenceFresh,
      provenance:snapshot.spaceship.provenance,
      ownerOnly:!configured,
      authorized:configured,
      requestedAction:configured?"reconcile_dns_cutover":""
    }));
  }

  if(snapshot.stripe){
    const liveAuthorized=snapshot.stripe.liveAuthorized===true;
    const completeProof=paymentProofComplete(snapshot.stripe.paymentProof);
    const providerReady=snapshot.stripe.providerReady===true;
    checkpoints.push(checkpoint({
      id:"DA-27",
      kind:"payment_path",
      evidenceFresh:snapshot.stripe.evidenceFresh,
      provenance:snapshot.stripe.provenance,
      ownerOnly:!(liveAuthorized&&providerReady&&completeProof),
      authorized:liveAuthorized,
      requestedAction:liveAuthorized&&providerReady&&completeProof
        ?"reconcile_payment_evidence"
        :"",
      providerReady,
      paymentProof:snapshot.stripe.paymentProof
    }));
  }

  if(snapshot.shopify){
    const readAuthorized=snapshot.shopify.readAuthorized===true;
    checkpoints.push(checkpoint({
      id:"DA-42",
      kind:"shopify_reconciliation",
      evidenceFresh:snapshot.shopify.evidenceFresh,
      provenance:snapshot.shopify.provenance,
      ownerOnly:false,
      authorized:readAuthorized,
      requestedAction:readAuthorized
        ?"observe_and_reconcile_verified_paid_orders"
        :""
    }));
  }

  if(snapshot.supabase){
    const nativeEnabled=snapshot.supabase.nativeLeakedPasswordProtection===true;
    checkpoints.push(checkpoint({
      id:"DA-19",
      kind:"auth_hardening",
      evidenceFresh:snapshot.supabase.evidenceFresh,
      provenance:snapshot.supabase.provenance,
      ownerOnly:!nativeEnabled,
      authorized:nativeEnabled,
      requestedAction:nativeEnabled?"reconcile_auth_hardening":""
    }));
  }

  if(snapshot.social){
    const linkedin=snapshot.social.linkedinCompanyPageAuthorized===true;
    const metricool=snapshot.social.metricoolBrandAuthorized===true;
    const complete=linkedin&&metricool;
    checkpoints.push(checkpoint({
      id:"DA-24",
      kind:"social_connection",
      evidenceFresh:snapshot.social.evidenceFresh,
      provenance:snapshot.social.provenance,
      ownerOnly:!complete,
      authorized:complete,
      requestedAction:complete?"verify_linkedin_metricool_connection":""
    }));
  }

  if(snapshot.titan){
    const prerequisitesComplete=
      snapshot.titan.commercialApprovalsComplete===true &&
      snapshot.titan.paymentPathVerified===true &&
      snapshot.titan.paidOrderEntitlementProof===true;

    checkpoints.push(checkpoint({
      id:"DA-34",
      kind:"public_launch",
      evidenceFresh:snapshot.titan.evidenceFresh,
      provenance:snapshot.titan.provenance,
      ownerOnly:prerequisitesComplete,
      authorized:prerequisitesComplete,
      requestedAction:prerequisitesComplete
        ?"authorize_public_founding_access"
        :""
    }));
  }

  return checkpoints;
}

export function routeVerificationSnapshot(snapshot={}){
  return routeVerificationEvidence(collectVerificationCheckpoints(snapshot));
}
