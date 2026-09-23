import {fingerprint} from "./core.mjs";

const AUDIO_KINDS = new Set(["soundtrack", "ambience", "sfx", "narration"]);

function finite(value, name, {min=-Infinity,max=Infinity}={}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(name);
  return number;
}

function requireSha256(value, name) {
  const hash = String(value || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(name);
  return hash;
}

function requireLocalFileUri(value, name) {
  const uri = String(value || "");
  if (!uri.startsWith("file://")) throw new Error(name);
  return uri;
}

function normalizeClip(clip, index) {
  if (!clip || typeof clip !== "object") throw new Error("assembly_clip_invalid:" + index);
  const shotId = String(clip.shotId || "").trim();
  if (!shotId) throw new Error("assembly_clip_shot_id_required:" + index);
  return {
    shotId,
    uri: requireLocalFileUri(clip.uri, "assembly_clip_local_uri_required:" + index),
    durationSeconds: finite(clip.durationSeconds, "assembly_clip_duration_invalid:" + index, {min:Number.EPSILON}),
    sha256: requireSha256(clip.sha256, "assembly_clip_sha256_invalid:" + index),
  };
}

function normalizeAudio(track, index) {
  if (!track || typeof track !== "object") throw new Error("assembly_audio_invalid:" + index);
  const kind = String(track.kind || "");
  if (!AUDIO_KINDS.has(kind)) throw new Error("assembly_audio_kind_invalid:" + index);
  return {
    id: String(track.id || `audio-${index + 1}`),
    kind,
    uri: requireLocalFileUri(track.uri, "assembly_audio_local_uri_required:" + index),
    startSeconds: finite(track.startSeconds ?? 0, "assembly_audio_start_invalid:" + index, {min:0}),
    durationSeconds: finite(track.durationSeconds, "assembly_audio_duration_invalid:" + index, {min:Number.EPSILON}),
    gainDb: finite(track.gainDb ?? 0, "assembly_audio_gain_invalid:" + index, {min:-60,max:12}),
    sha256: requireSha256(track.sha256, "assembly_audio_sha256_invalid:" + index),
  };
}

function normalizeCaption(caption, index, totalDurationSeconds) {
  if (!caption || typeof caption !== "object") throw new Error("assembly_caption_invalid:" + index);
  const text = String(caption.text || "").trim();
  if (!text) throw new Error("assembly_caption_text_required:" + index);
  const startSeconds = finite(caption.startSeconds, "assembly_caption_start_invalid:" + index, {min:0});
  const endSeconds = finite(caption.endSeconds, "assembly_caption_end_invalid:" + index, {min:0});
  if (endSeconds <= startSeconds) throw new Error("assembly_caption_range_invalid:" + index);
  if (endSeconds > totalDurationSeconds + 0.001) throw new Error("assembly_caption_out_of_range:" + index);
  return {
    text,
    startSeconds,
    endSeconds,
    style: String(caption.style || "default"),
  };
}

export function createAssemblyPlan({projectId, clips, audioTracks=[], captions=[], policy={}}) {
  if (!String(projectId || "").trim()) throw new Error("assembly_project_id_required");
  if (!Array.isArray(clips) || clips.length === 0) throw new Error("assembly_clips_required");

  const normalizedClips = clips.map(normalizeClip);
  const ids = new Set();
  for (const clip of normalizedClips) {
    if (ids.has(clip.shotId)) throw new Error("assembly_duplicate_shot:" + clip.shotId);
    ids.add(clip.shotId);
  }

  const totalDurationSeconds = normalizedClips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
  const normalizedAudio = audioTracks.map(normalizeAudio);
  for (const track of normalizedAudio) {
    if (track.startSeconds + track.durationSeconds > totalDurationSeconds + 0.001) {
      throw new Error("assembly_audio_out_of_range:" + track.id);
    }
  }

  const normalizedCaptions = captions.map((caption,index) => normalizeCaption(caption,index,totalDurationSeconds));
  const normalizedPolicy = {
    targetLufs: finite(policy.targetLufs ?? -14, "assembly_target_lufs_invalid", {min:-24,max:-8}),
    truePeakDbtp: finite(policy.truePeakDbtp ?? -1, "assembly_true_peak_invalid", {min:-6,max:0}),
    loudnessRange: finite(policy.loudnessRange ?? 11, "assembly_lra_invalid", {min:1,max:20}),
    captionBurnIn: policy.captionBurnIn !== false,
    ducking: {
      enabled: policy.ducking?.enabled !== false,
      attackMs: finite(policy.ducking?.attackMs ?? 20, "assembly_duck_attack_invalid", {min:1,max:2000}),
      releaseMs: finite(policy.ducking?.releaseMs ?? 250, "assembly_duck_release_invalid", {min:10,max:5000}),
    },
  };

  const unsigned = {
    schema: "sauceapproved.hercules.video-assembly-plan",
    version: 1,
    projectId: String(projectId),
    clips: normalizedClips,
    audioTracks: normalizedAudio,
    captions: normalizedCaptions,
    policy: normalizedPolicy,
    totalDurationSeconds,
  };
  return {...unsigned, fingerprint:fingerprint(unsigned)};
}

export function validateAssemblyPlan(plan) {
  if (!plan || typeof plan !== "object") throw new Error("assembly_plan_required");
  const supplied = String(plan.fingerprint || "");
  const unsigned = {...plan};
  delete unsigned.fingerprint;
  if (!supplied || fingerprint(unsigned) !== supplied) throw new Error("assembly_plan_fingerprint_mismatch");
  return plan;
}

export function buildCaptionTimelineFromStoryboard(storyboard) {
  if (!storyboard?.shots?.length) throw new Error("assembly_storyboard_required");
  let cursor = 0;
  const captions = [];
  for (const shot of storyboard.shots) {
    const duration = finite(shot.durationSeconds, "assembly_storyboard_duration_invalid", {min:Number.EPSILON});
    const startSeconds = cursor;
    const endSeconds = cursor + duration;
    if (shot.text) captions.push({text:String(shot.text), startSeconds, endSeconds});
    cursor = endSeconds;
  }
  return captions;
}

export function createAssemblyEvidence({plan, output}) {
  validateAssemblyPlan(plan);
  if (!output || typeof output !== "object") throw new Error("assembly_output_required");
  const evidence = {
    schema:"sauceapproved.hercules.video-assembly-evidence",
    version:1,
    planFingerprint:plan.fingerprint,
    output:{
      uri:requireLocalFileUri(output.uri,"assembly_output_local_uri_required"),
      mimeType:String(output.mimeType || "video/mp4"),
      sizeBytes:finite(output.sizeBytes,"assembly_output_size_invalid",{min:1}),
      sha256:requireSha256(output.sha256,"assembly_output_sha256_invalid"),
    },
  };
  return {...evidence, fingerprint:fingerprint(evidence)};
}
