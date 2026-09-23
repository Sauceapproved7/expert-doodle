# Hercules Video v0.7 — Post-Production Assembly

## Purpose

Hercules Video now owns the post-production contract that turns verified shot renders into a final media artifact.

FFmpeg is an execution binary behind Hercules. It does not own the timeline, mix policy, caption timing, or provenance model.

## Hercules-owned assembly plan

The plan records:

- ordered shot clips and their SHA-256 hashes,
- soundtrack / ambience / SFX / narration tracks,
- start time, duration, and gain for each audio track,
- caption text and timing,
- integrated loudness target,
- true-peak ceiling,
- loudness range,
- narration ducking policy,
- deterministic plan fingerprint.

All input media must use local `file://` URIs. The assembly layer does not fetch remote media.

## Audio policy

Default final mix:

- target integrated loudness: **-14 LUFS**,
- true peak ceiling: **-1 dBTP**,
- loudness range target: **11 LU**,
- narration may sidechain-duck the soundtrack/ambience/SFX bed.

These are initial Hercules defaults and remain versioned in the assembly plan.

## Captions

Storyboard text can be converted into a deterministic caption timeline. The initial local runner burns text into the video through FFmpeg drawtext.

## Final evidence

A successful assembly produces:

- final local media URI,
- final byte size,
- final SHA-256,
- source assembly-plan fingerprint,
- deterministic assembly-evidence fingerprint.

That evidence is what Hercules can carry into export, publishing, or later audit.

## Ownership boundary

Hercules owns:

- timeline ordering,
- media constraints,
- mix/caption policy,
- deterministic plan,
- FFmpeg command compilation,
- timeout/error handling,
- final evidence.

FFmpeg remains a separately installed third-party binary.

## Next increment

Add a campaign execution coordinator that:

1. compiles the Hercules launch storyboard,
2. creates visual render jobs per shot,
3. collects winners from render tournaments,
4. builds the assembly plan,
5. attaches soundtrack/SFX/narration/captions,
6. produces the final launch-video evidence package.
