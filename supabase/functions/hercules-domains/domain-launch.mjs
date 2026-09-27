export const SAUCEAPPROVED_DOMAIN = "sauceapproved.com";
export const SHOPIFY_TARGET = Object.freeze({
  apexA:"23.227.38.65",
  apexAAAA:"2620:0127:f00f:5::",
  wwwCname:"shops.myshopify.com",
});

function clean(values=[]){
  return [...new Set((Array.isArray(values)?values:[])
    .map(v=>String(v||"").trim().toLowerCase().replace(/\.$/,""))
    .filter(Boolean))].sort();
}

export function analyzeDomainLaunch({
  a=[],
  aaaa=[],
  cname=[],
  ns=[],
  credentialStatus="unconfigured",
  primaryTargetId=null,
  sslStatus="unknown",
}={}){
  const A=clean(a), AAAA=clean(aaaa), CNAME=clean(cname), NS=clean(ns);
  const aReady=A.length===1 && A[0]===SHOPIFY_TARGET.apexA;
  const aaaaReady=AAAA.length===1 && AAAA[0]===SHOPIFY_TARGET.apexAAAA;
  const cnameReady=CNAME.length===1 && CNAME[0]===SHOPIFY_TARGET.wwwCname;
  const dnsReady=aReady&&aaaaReady&&cnameReady;
  const registrarReady=credentialStatus==="configured";
  const blockers=[];
  if(!registrarReady) blockers.push("spaceship_credentials_unconfigured");
  if(!aReady) blockers.push("apex_a_not_shopify");
  if(!aaaaReady) blockers.push("apex_aaaa_not_shopify");
  if(!cnameReady) blockers.push("www_cname_not_shopify");
  if(!primaryTargetId) blockers.push("shopify_target_not_recorded");
  return Object.freeze({
    domain:SAUCEAPPROVED_DOMAIN,
    desired:SHOPIFY_TARGET,
    observed:{a:A,aaaa:AAAA,cname:CNAME,ns:NS},
    readiness:{
      registrarReady,
      dnsReady,
      readyForDnsReconcile:registrarReady && !dnsReady,
      readyForShopifyVerification:dnsReady,
      sslKnownGood:String(sslStatus).toLowerCase()==="active"||String(sslStatus).toLowerCase()==="enabled",
    },
    target:{primaryTargetId},
    blockers,
  });
}
