function normalizeAdapters(input={}) {
  const output={};
  for (const [target,adapter] of Object.entries(input)) {
    const safeTarget=String(target).trim().toLowerCase();
    if (!safeTarget || !adapter || typeof adapter!=="object") continue;
    output[safeTarget]=Object.freeze({...adapter});
  }
  return Object.freeze(output);
}

export function createOperatorAdapterRegistry(input={}) {
  const adapters=normalizeAdapters(input);
  return Object.freeze({
    adapters,
    capabilities() {
      return Object.entries(adapters)
        .map(([target,adapter])=>({
          target,
          verbs:Object.keys(adapter).filter((key)=>typeof adapter[key]==="function").sort()
        }))
        .sort((a,b)=>a.target.localeCompare(b.target));
    }
  });
}

export function createHardwareBodyInterface({transport=null}={}) {
  let emergencyStop=true;
  let armed=false;
  let hardwareConnected=Boolean(transport?.reviewed===true && typeof transport?.send==="function");

  return Object.freeze({
    async status() {
      return {hardwareConnected,emergencyStop,armed,motorsCommanded:false};
    },
    async arm({ownerApproved=false}={}) {
      if (!ownerApproved) return {armed:false,reason:"owner-approval-required"};
      if (!hardwareConnected) return {armed:false,reason:"hardware-transport-not-configured"};
      emergencyStop=false;
      armed=true;
      return {armed:true,emergencyStop:false};
    },
    async emergencyStop() {
      armed=false;
      emergencyStop=true;
      if (hardwareConnected) await transport.send({type:"emergency-stop"});
      return {armed:false,emergencyStop:true};
    },
    async disconnect() {
      if (hardwareConnected) await transport.send({type:"emergency-stop"});
      armed=false;
      emergencyStop=true;
      hardwareConnected=false;
      return {disconnected:true,emergencyStop:true};
    }
  });
}
