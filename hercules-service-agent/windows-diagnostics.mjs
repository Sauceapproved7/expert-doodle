function level(value,{warning,critical}) {
  if (!Number.isFinite(value)) return {status:"unknown",value:null};
  if (value >= critical) return {status:"critical",value};
  if (value >= warning) return {status:"warning",value};
  return {status:"healthy",value};
}

export function normalizeWindowsDiagnostics(input={}) {
  if (input.platform !== "win32") throw new Error("Windows diagnostic input required");
  const free=Number(input.freeDiskPercent);
  const memory=Number(input.memoryPressurePercent);
  const failed=Number(input.failedUpdates);
  return Object.freeze({
    schema:"sauceapproved.hercules-service-agent.diagnostic-report",
    version:1,
    platform:"win32",
    readOnly:true,
    collectedAt:new Date().toISOString(),
    signals:Object.freeze({
      disk:Object.freeze(!Number.isFinite(free)?{status:"unknown",value:null}:{status:free<10?"critical":free<20?"warning":"healthy",value:free}),
      memory:Object.freeze(level(memory,{warning:85,critical:95})),
      updates:Object.freeze({status:failed>0?"warning":"healthy",failedUpdates:Number.isFinite(failed)?Math.max(0,failed):0,pendingReboot:input.pendingReboot===true}),
      startup:Object.freeze({status:input.startupImpact==="high"?"warning":"healthy",impact:["low","medium","high"].includes(input.startupImpact)?input.startupImpact:"unknown"})
    }),
    privacy:Object.freeze({privateContentCollected:false,credentialsCollected:false,browserHistoryCollected:false})
  });
}
