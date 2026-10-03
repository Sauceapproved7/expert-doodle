import {randomUUID} from "node:crypto";

export function createServiceSession({customerConsent,deviceId}={}){
  if(customerConsent!==true) throw new Error("customer consent required");
  if(!deviceId) throw new Error("device identity required");
  return Object.freeze({
    schema:"sauceapproved.hercules-service-agent.session",version:1,id:randomUUID(),deviceId,
    mode:"diagnostic",permissions:{inspectTechnicalHealth:true,privateContent:false,credentials:false,mutate:false},
    audit:[],createdAt:new Date().toISOString()
  });
}

export function authorizeServiceSession(session,{repairApproval}={}){
  if(session?.schema!=="sauceapproved.hercules-service-agent.session") throw new Error("valid service session required");
  if(repairApproval!==true) throw new Error("explicit repair authorization required");
  return Object.freeze({...session,mode:"repair-authorized",permissions:{...session.permissions,mutate:true}});
}

export function planRepair({session,diagnosis,capsule}={}){
  if(session?.permissions?.mutate!==true) throw new Error("repair authorization required");
  if(!capsule?.id||capsule.verified!==true) throw new Error("verified recovery capsule required before mutation");
  if(!diagnosis?.code) throw new Error("diagnosis required");
  return Object.freeze({
    schema:"sauceapproved.hercules-service-agent.repair-plan",version:1,
    sessionId:session.id,deviceId:session.deviceId,diagnosis,
    recoveryCapsuleId:capsule.id,failClosed:true,requiresVerification:true,
    allowedActions:[],createdAt:new Date().toISOString()
  });
}
