function status(ok, blocked=false){return ok?"ready":blocked?"blocked":"pending"}

export function buildDomainControlCenter({
  launch=null,
  shopifyCutover=null,
  launchReadiness=null,
  https=null,
}={}){
  const readiness=launch?.readiness||{};
  const dnsReady=readiness.dnsReady===true;
  const registrarReady=readiness.registrarReady===true;
  const attached=shopifyCutover?.intended_domain_present===true;
  const sslReady=shopifyCutover?.intended_domain_ssl_enabled===true || readiness.sslKnownGood===true;
  const blockers=[];
  if(!registrarReady) blockers.push("registrar_not_ready");
  if(!dnsReady) blockers.push("dns_not_ready");
  if(dnsReady&&!attached) blockers.push("shopify_domain_not_attached");
  if(dnsReady&&!sslReady) blockers.push("shopify_ssl_not_enabled");
  const open=dnsReady&&attached&&sslReady;
  return Object.freeze({
    version:"1.0.0",
    mode:"read_only",
    components:{
      registrar:{status:status(registrarReady)},
      dns:{status:status(dnsReady,!registrarReady)},
      shopify:{status:status(attached,!dnsReady)},
      ssl:{status:status(sslReady,!dnsReady||!attached)},
      https:{status:status(https?.reachable===true)},
    },
    deploymentGate:{open,blockers},
    providerBlockers:Array.isArray(launch?.blockers)?[...launch.blockers]:[],
    shopifyStage:shopifyCutover?.stage||null,
    launchStage:launchReadiness?.stage||null,
    capabilities:{readOnly:true,mutation:false},
  });
}
