# Hercules Video v0.10 — Launch Entrypoint

## Purpose

v0.10 is the first single-command launch path across the Hercules-owned video stack.

It connects the already-merged boundaries in this order:

**canonical launch preset → Wan2.2 local runner → Hercules local runtime → self-hosted adapter → campaign execution service → post-render evaluator → tournament acceptance → FFmpeg assembly → final evidence receipt**

The launcher does not introduce a commercial video provider, vendor SDK, network downloader, credential manager, or production publisher.

## Canonical command

```bash
node hercules-video/launch-hercules.mjs /absolute/path/to/hercules-launch-config.json
```

The configuration path must be absolute.

The launcher always uses the repository-owned preset:

```text
hercules-video/presets/hercules-launch.json
```

A caller may omit `presetPath`. If it supplies `presetPath`, the path must resolve to that canonical file.

## Required local configuration

Example:

```json
{
  "projectId": "hercules-launch",
  "wanRepoDir": "/opt/hercules/vendor/Wan2.2",
  "checkpointDir": "/opt/hercules/models/Wan2.2-TI2V-5B",
  "checkpointSha256": "64-lowercase-hex-checkpoint-evidence",
  "upstreamCommit": "40-lowercase-hex-upstream-commit",
  "renderOutputDir": "/var/lib/hercules/video/renders",
  "finalOutputPath": "/var/lib/hercules/video/hercules-launch.mp4",
  "evidenceOutputPath": "/var/lib/hercules/video/hercules-launch.evidence.json",
  "evaluationCommand": "/opt/hercules/bin/video-evaluator",
  "evaluationArgs": [],
  "evaluationTimeoutMs": 60000,
  "minimumScore": 0.78,
  "maxPolls": 120,
  "pollIntervalMs": 250,
  "python": "python",
  "ffmpegBinary": "ffmpeg",
  "audioTracks": [
    {
      "id": "launch-music",
      "kind": "soundtrack",
      "path": "/var/lib/hercules/video/audio/launch.wav",
      "startSeconds": 0,
      "durationSeconds": 25,
      "gainDb": -8,
      "sha256": "64-lowercase-hex-audio-sha256"
    }
  ]
}
```

`python` and `ffmpegBinary` are optional. The remaining path/evidence fields are required for the command-line launch path.

## Post-render evaluator boundary

Hercules does not invent visual-quality scores.

After each render completes, the launcher sends one JSON request to the configured local evaluator over stdin:

```json
{
  "schema": "sauceapproved.hercules.video-evaluation-request",
  "version": 1,
  "shot": {},
  "request": {},
  "artifact": {},
  "route": {}
}
```

The evaluator must emit exactly one JSON object on stdout:

```json
{
  "artifactSha256": "sha256-of-the-render-being-scored",
  "method": "declared-measurement-method",
  "evaluatorId": "local-evaluator-id",
  "quality": {
    "promptAdherence": 0.0,
    "temporalConsistency": 0.0,
    "visualQuality": 0.0,
    "brandConsistency": 0.0,
    "audioQuality": 0.0,
    "artifactFreedom": 0.0,
    "reliability": 0.0
  }
}
```

Every quality dimension must be a finite value from 0 through 1.

The returned `artifactSha256` must exactly match the completed render artifact. This prevents a score from being reused against a different render.

Programmatic callers may inject an evaluator function instead of an executable. Injected results are subject to the same artifact binding, method, evaluator ID, and quality validation.

The launcher does not claim how good or authoritative an evaluator is. It records the evaluator ID, declared method, exact artifact hash, normalized quality values, and deterministic evidence fingerprint so later policy can decide whether that evidence is sufficient.

## Fail-closed behavior

The command stops instead of fabricating progress when any required boundary is missing or invalid, including:

- noncanonical launch preset,
- missing Wan2.2 repository/checkpoint/render directories,
- missing or malformed upstream commit evidence,
- missing checkpoint SHA-256 evidence,
- missing local evaluator,
- evaluator timeout/failure/invalid JSON,
- evaluator result bound to the wrong artifact,
- missing quality dimensions,
- missing approved post-production audio,
- audio SHA-256 mismatch,
- unhealthy CUDA/Wan runtime,
- failed or missing render artifacts,
- insufficient evaluated quality,
- FFmpeg assembly failure,
- missing final output,
- mismatch between the final file SHA-256 and campaign evidence,
- pre-existing final output or launch evidence file.

The output and evidence paths must not already exist. This prevents a new run from silently overwriting prior launch evidence.

## Final evidence

A successful command writes a machine-readable evidence file beside the final video by default:

```text
<finalOutputPath>.evidence.json
```

The receipt records:

- canonical preset path and SHA-256,
- execution-plan fingerprint,
- final execution-session fingerprint,
- every post-render evaluation record and its fingerprint,
- Wan runtime ID,
- upstream Wan commit,
- checkpoint SHA-256 evidence,
- approved audio identities and SHA-256 values,
- campaign evidence,
- actual final video SHA-256,
- deterministic launch-evidence fingerprint.

The final video is re-hashed after assembly. Hercules refuses to emit the launch receipt if that hash differs from the SHA-256 claimed by the campaign evidence.

## Ownership boundary

Hercules owns the launch configuration contract, path validation, evaluator boundary, orchestration wiring, evidence linkage, final hash verification, and fail-closed behavior.

Wan2.2 remains a separately installed local rendering runtime. FFmpeg remains a separately installed local assembly binary. A local evaluator remains a replaceable measurement boundary.

## Next increment

After v0.10 is canonical, the next useful increment is persistent launch-run state and restart/resume support so a long local render campaign can recover after process interruption without weakening artifact or evidence checks.
