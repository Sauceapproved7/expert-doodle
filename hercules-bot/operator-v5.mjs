export function createOperatorSession({console,initiallyStopped=false}={}) {
  if(!console || typeof console.plan!=="function" || typeof console.execute!=="function") {
    throw new TypeError("governed operator console required");
  }
  let pending=null;
  let stopped=initiallyStopped===true;

  return Object.freeze({
    async receive(input) {
      const plan=await console.plan(input);
      if(plan.status!=="planned") return plan;
      if(stopped&&plan.requiresApproval) return {mode:"stopped",reason:"emergency-stop-active"};
      if(plan.requiresApproval) {
        pending={input,plan};
        return {mode:"awaiting-approval",command:plan.command};
      }
      return {mode:"planned",command:plan.command};
    },
    pending() { return pending ? {command: pending.plan.command, input: pending.input} : null; },
    async approve() {
      if(stopped) return {status:"stopped",reason:"emergency-stop-active"};
      if(!pending) return {status:"no-pending-command"};
      const item=pending;
      pending=null;
      return console.execute(item.input,{ownerApproved:true});
    },
    async emergencyStop() {
      pending=null;
      stopped=true;
      return {status:"stopped",reason:"emergency-stop-active"};
    },
    async resume() {
      stopped=false;
      return {status:"ready"};
    }
  });
}
