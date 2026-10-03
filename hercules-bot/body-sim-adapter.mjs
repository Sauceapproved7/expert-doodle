const ALLOWED_POSES=new Set(["stand","sit","neutral","wave"]);

export function createSimulatedBodyAdapter() {
  return Object.freeze({
    async move({payload={}}={}) {
      const pose=String(payload.pose ?? "").trim().toLowerCase();
      if (!ALLOWED_POSES.has(pose)) {
        throw Object.assign(new Error("unsupported simulated body pose"),{code:"unsupported-pose"});
      }
      return Object.freeze({
        simulated:true,
        hardwareConnected:false,
        pose,
        motorsCommanded:false
      });
    },
    async status() {
      return Object.freeze({
        simulated:true,
        hardwareConnected:false,
        emergencyStopAvailable:true,
        motorsCommanded:false
      });
    }
  });
}
