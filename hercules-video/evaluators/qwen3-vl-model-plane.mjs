const MODEL_ID="Qwen/Qwen3-VL-4B-Instruct";
const LICENSE="apache-2.0";

export function createQwen3VlEvaluationModelManifest(modelEvidence) {
  if (!modelEvidence || typeof modelEvidence!=="object") throw new Error("qwen_model_evidence_required");
  if (modelEvidence.modelId!==MODEL_ID) throw new Error("qwen_model_id_mismatch");
  if (String(modelEvidence.license||"").toLowerCase()!==LICENSE) throw new Error("qwen_model_license_mismatch");
  const checkpoint=String(modelEvidence.manifestFingerprint||"").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(checkpoint)) throw new Error("qwen_model_manifest_fingerprint_required");
  return {
    version:"0.1",
    id:"qwen3-vl-4b-evaluator",
    family:"qwen3-vl",
    description:"Open-weight local video/vision evaluator for Hercules render acceptance.",
    tasks:["vision"],
    state:"candidate",
    origin:"open-weight",
    priority:100,
    checkpoint,
    runtime:{kind:"embedded",endpoint:null},
    provenance:"Third-party Apache-2.0 Qwen3-VL-4B-Instruct checkpoint verified by Hercules local model manifest. Evaluation-only; not a Hercules-native production checkpoint.",
  };
}
