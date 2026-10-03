import {getRepairModule} from "./repair-catalog.mjs";

export function bindRepairExecution({session,repairCode,capsule}={}){
  if(session?.schema!=="sauceapproved.hercules-service-agent.session"||session?.permissions?.mutate!==true){
    throw new Error("repair-authorized service session required");
  }
  const repair=getRepairModule(repairCode);
  if(capsule?.schema!=="sauceapproved.hercules-cleaner.recovery-capsule"||capsule?.state!=="sealed"||!capsule?.id){
    throw new Error("sealed recovery capsule required");
  }
  return Object.freeze({
    schema:"sauceapproved.hercules-service-agent.bound-repair",
    version:1,sessionId:session.id,deviceId:session.deviceId,
    recoveryCapsuleId:capsule.id,repair,
    execute:false,requiresPostRepairVerification:true,failClosed:true
  });
}
