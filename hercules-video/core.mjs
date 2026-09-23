import {createHash} from "node:crypto";

export const HERCULES_VIDEO_VERSION = "0.1.0";

export const QUALITY_DIMENSIONS = Object.freeze([
  "promptAdherence",
  "temporalConsistency",
  "visualQuality",
  "brandConsistency",
  "audioQuality",
  "artifactFreedom",
  "reliability",
]);

export const DEFAULT_QUALITY_WEIGHTS = Object.freeze({
  promptAdherence: 0.24,
  temporalConsistency: 0.20,
  visualQuality: 0.18,
  brandConsistency: 0.16,
  audioQuality: 0.10,
  artifactFreedom: 0.08,
  reliability: 0.04,
});

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function fingerprint(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

export function normalizeQuality(quality = {}) {
  const normalized = {};
  for (const dimension of QUALITY_DIMENSIONS) {
    normalized[dimension] = clamp01(quality[dimension]);
  }
  return normalized;
}

export function weightedQualityScore(quality, weights = DEFAULT_QUALITY_WEIGHTS) {
  const normalized = normalizeQuality(quality);
  let weighted = 0;
  let weightTotal = 0;
  for (const dimension of QUALITY_DIMENSIONS) {
    const weight = Math.max(0, Number(weights[dimension] || 0));
    weighted += normalized[dimension] * weight;
    weightTotal += weight;
  }
  return weightTotal ? weighted / weightTotal : 0;
}

export function validateShot(shot) {
  if (!shot || typeof shot !== "object") throw new Error("shot_required");
  if (!String(shot.id || "").trim()) throw new Error("shot_id_required");
  if (!String(shot.prompt || "").trim()) throw new Error("shot_prompt_required");
  const durationSeconds = Number(shot.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("shot_duration_required");
  if (!String(shot.aspectRatio || "").trim()) throw new Error("shot_aspect_ratio_required");
  return {...shot, durationSeconds};
}

export function validateProvider(provider) {
  if (!provider || typeof provider !== "object") throw new Error("provider_required");
  if (!String(provider.id || "").trim()) throw new Error("provider_id_required");
  if (!String(provider.label || "").trim()) throw new Error("provider_label_required");
  const capabilities = provider.capabilities;
  if (!capabilities || typeof capabilities !== "object") throw new Error("provider_capabilities_required");
  if (!Array.isArray(capabilities.aspectRatios) || capabilities.aspectRatios.length === 0) {
    throw new Error("provider_aspect_ratios_required");
  }
  const maxDurationSeconds = Number(capabilities.maxDurationSeconds);
  if (!Number.isFinite(maxDurationSeconds) || maxDurationSeconds <= 0) {
    throw new Error("provider_max_duration_required");
  }
  return {
    ...provider,
    capabilities: {...capabilities, maxDurationSeconds},
    quality: normalizeQuality(provider.quality),
    cost: {
      estimatedCreditsPerSecond: Math.max(0, Number(provider.cost?.estimatedCreditsPerSecond || 0)),
      priorityPenalty: Math.max(0, Number(provider.cost?.priorityPenalty || 0)),
    },
  };
}

export function providerSupportsShot(providerInput, shotInput) {
  const provider = validateProvider(providerInput);
  const shot = validateShot(shotInput);
  const caps = provider.capabilities;
  if (!caps.aspectRatios.includes(shot.aspectRatio)) return false;
  if (shot.durationSeconds > caps.maxDurationSeconds) return false;
  if (shot.requiresAudio && caps.nativeAudio !== true) return false;
  if (shot.requiresReferences && caps.references !== true) return false;
  if (shot.requiresEditing && caps.editing !== true) return false;
  return true;
}

export function routeShot(shotInput, providerInputs, options = {}) {
  const shot = validateShot(shotInput);
  const providers = providerInputs.map(validateProvider);
  const weights = options.qualityWeights || DEFAULT_QUALITY_WEIGHTS;
  const maxCredits = Number.isFinite(Number(options.maxCredits)) ? Number(options.maxCredits) : Infinity;

  const candidates = providers
    .filter(provider => providerSupportsShot(provider, shot))
    .map(provider => {
      const quality = weightedQualityScore(provider.quality, weights);
      const estimatedCredits = provider.cost.estimatedCreditsPerSecond * shot.durationSeconds;
      const costPressure = maxCredits === Infinity || maxCredits <= 0 ? 0 : Math.min(1, estimatedCredits / maxCredits);
      const routingScore = quality - (costPressure * 0.12) - (provider.cost.priorityPenalty * 0.05);
      return {
        providerId: provider.id,
        label: provider.label,
        qualityScore: quality,
        estimatedCredits,
        routingScore,
      };
    })
    .filter(candidate => candidate.estimatedCredits <= maxCredits)
    .sort((a, b) => b.routingScore - a.routingScore || b.qualityScore - a.qualityScore || a.providerId.localeCompare(b.providerId));

  if (!candidates.length) {
    return {
      status: "blocked",
      reason: "no_provider_satisfies_shot_constraints",
      shotId: shot.id,
      candidates: [],
    };
  }

  return {
    status: "routed",
    shotId: shot.id,
    selected: candidates[0],
    alternates: candidates.slice(1),
  };
}

export function scoreRender(render, weights = DEFAULT_QUALITY_WEIGHTS) {
  if (!render || typeof render !== "object") throw new Error("render_required");
  const quality = normalizeQuality(render.quality);
  const score = weightedQualityScore(quality, weights);
  return {
    renderId: render.id,
    providerId: render.providerId,
    score,
    quality,
    passed: score >= Number(render.minimumAcceptableScore ?? 0.78),
  };
}

export function selectBestRender(renders, weights = DEFAULT_QUALITY_WEIGHTS) {
  if (!Array.isArray(renders) || renders.length === 0) throw new Error("renders_required");
  return renders
    .map(render => ({...render, evaluation: scoreRender(render, weights)}))
    .sort((a, b) => b.evaluation.score - a.evaluation.score || String(a.id).localeCompare(String(b.id)))[0];
}

export function buildRunManifest({projectId, brief, shots, providers, policy = {}}) {
  if (!String(projectId || "").trim()) throw new Error("project_id_required");
  if (!brief || typeof brief !== "object") throw new Error("brief_required");
  const normalizedShots = shots.map(validateShot);
  const normalizedProviders = providers.map(validateProvider);
  const manifest = {
    schema: "sauceapproved.hercules.video-run",
    version: 1,
    herculesVideoVersion: HERCULES_VIDEO_VERSION,
    projectId,
    brief,
    shots: normalizedShots,
    providers: normalizedProviders.map(provider => ({
      id: provider.id,
      label: provider.label,
      capabilities: provider.capabilities,
      quality: provider.quality,
      cost: provider.cost,
    })),
    policy: {
      requireOriginalOrLicensedInputs: policy.requireOriginalOrLicensedInputs !== false,
      preserveProvenance: policy.preserveProvenance !== false,
      allowSingleVendorLockIn: policy.allowSingleVendorLockIn === true,
      minimumAcceptableScore: Number(policy.minimumAcceptableScore ?? 0.78),
    },
  };
  return {...manifest, fingerprint: fingerprint(manifest)};
}
