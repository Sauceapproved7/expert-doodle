import {getMarketplaceApp} from "./catalog.mjs";

function result(fields){return Object.freeze({sideEffects:false,...fields});}

export function createMarketplaceInstallPlan({
  appId,
  audience="public",
  commercialReady=false,
  publicRegistrationOpen=false,
  pilotAuthorized=false,
}={}){
  const ownerApp=getMarketplaceApp(appId,{audience:"owner"});
  if(!ownerApp)return result({allowed:false,reason:"app_not_found",requiresExecutionHandoff:false});

  if(ownerApp.visibility==="internal"&&audience!=="owner"){
    return result({allowed:false,reason:"owner_only_product",requiresExecutionHandoff:false});
  }

  if(ownerApp.id==="hercules"){
    if(commercialReady===true&&publicRegistrationOpen===true){
      return result({allowed:true,mode:"public-release",reason:null,requiresExecutionHandoff:true});
    }
    if(pilotAuthorized===true){
      return result({allowed:true,mode:"controlled-pilot",reason:null,requiresExecutionHandoff:true});
    }
    return result({
      allowed:false,
      reason:publicRegistrationOpen===true?"commercial_readiness_required":"controlled_pilot_authorization_required",
      requiresExecutionHandoff:false,
    });
  }

  if(ownerApp.visibility==="internal"){
    return result({allowed:audience==="owner",mode:audience==="owner"?"owner-preview":undefined,reason:audience==="owner"?null:"owner_only_product",requiresExecutionHandoff:audience==="owner"});
  }

  return result({allowed:true,mode:"preview",reason:null,requiresExecutionHandoff:true});
}
