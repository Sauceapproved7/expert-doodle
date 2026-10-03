import {createDurableReleaseTruthLedger} from "./durable-ledger.mjs";
import {createTrustedReleaseTruthOperator} from "./trusted-operator.mjs";

export async function createTrustedDurableReleaseTruthOperator({path,authorize}={}){
 const ledger=await createDurableReleaseTruthLedger({path});
 const operator=createTrustedReleaseTruthOperator({authorize,ledger});
 return Object.freeze({
  record:operator.record,
  revoke:operator.revoke,
  history:ledger.history,
  currentEvidence:ledger.currentEvidence,
  mutationPolicy:operator.mutationPolicy,
  publicHttpMutationAllowed:false,
  storage:ledger.storage
 });
}
