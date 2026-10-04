export function createLocalVisionEvaluationModelManifest({
  id="local-vision-evaluator",
  family="local-vision",
  checkpoint,
  provenance,
  description="Local open-weight vision evaluator candidate for Hercules Video semantic quality evidence.",
  priority=100,
}={}) {
  const clean=value=>String(value??"").trim();
  const model={
    version:"0.1",
    id:clean(id),
    family:clean(family),
    description:clean(description),
    tasks:["vision"],
    state:"candidate",
    origin:"open-weight",
    priority,
    checkpoint:clean(checkpoint)||null,
    runtime:{kind:"embedded",endpoint:null},
    provenance:clean(provenance)||null,
  };
  if (!model.checkpoint?.startsWith("local://")) throw new Error("local_vision_checkpoint_required");
  if (!model.provenance?.startsWith("verified-local-model-evidence:")) throw new Error("local_vision_verified_provenance_required");
  return Object.freeze(model);
}
