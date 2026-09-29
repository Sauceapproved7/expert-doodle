export function evaluateRfqLine(x={}){
 const reasons=[];if(x.exactMpn!==true)reasons.push('exact_mpn_not_confirmed');if(x.authorizedSource!==true)reasons.push('authorized_source_not_confirmed');if(x.traceable!==true)reasons.push('traceability_not_confirmed');if(x.substitution===true)reasons.push('substitution_requires_requalification');
 return {eligible:reasons.length===0,reasons,quoteOnly:true,purchaseAuthorized:false,productionAuthorized:false};
}