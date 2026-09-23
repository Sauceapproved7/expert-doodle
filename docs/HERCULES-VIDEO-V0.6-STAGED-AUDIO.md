# Hercules Video v0.6 — Staged Audio

## Purpose

Hercules Video now distinguishes **native audio generation** from **post-production audio**.

This prevents a visual model from being rejected simply because the final video needs sound.

## Shot contract

A shot may use:

- `audioStrategy: "none"` — no audio is required.
- `audioStrategy: "native"` — the render engine must generate synchronized audio itself.
- `audioStrategy: "post"` — the visual engine may render silently; Hercules must add audio during a later assembly stage.

For backward compatibility, a shot with `requiresAudio: true` and no explicit strategy defaults to `native`.

## Routing

Provider capability routing requires `nativeAudio: true` only when the shot uses `audioStrategy: "native"`.

A `post` shot may route to a visual-only engine.

## Launch campaign

The Hercules launch preset now uses:

```json
{
  "requireAudio": true,
  "audioStrategy": "post"
}
```

That means Wan2.2 TI2V-5B can generate the launch visuals while Hercules retains the audio requirement for the post-production stage.

## Wan2.2 behavior

The Wan runner:

- rejects native-audio requests,
- accepts post-audio requests,
- records `nativeAudio: false` in artifact metadata,
- never pretends that sound was generated.

## Next increment

Build the Hercules-owned post-production assembly layer:

1. ordered clip assembly,
2. soundtrack / ambience / SFX lanes,
3. narration lane,
4. caption/text timing,
5. loudness/ducking policy,
6. final media checksum and provenance manifest.
