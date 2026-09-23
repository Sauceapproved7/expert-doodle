# Hercules Video v0.5 — Wan2.2 TI2V-5B Local Runner

## Scope

This increment adds a provider-specific runner **behind** the Hercules-owned local runner contract. The Hercules core, storyboard, render bridge, and local runtime remain provider-neutral.

## Why this is separated

`hercules-video/runners/wan22-ti2v-5b.mjs` may understand Wan's CLI. No other Hercules-owned layer may depend on Wan request shapes.

## Hardware gate

The runner requires a recorded CUDA hardware probe with at least one GPU meeting the Hercules policy floor of a **24 GB-class VRAM device**. This matches Wan's official documented single-GPU TI2V-5B path using:

- `--offload_model True`
- `--convert_model_dtype`
- `--t5_cpu`

If the gate fails, Hercules refuses the render. There is no commercial/cloud fallback.

## Supported initial profile

- Task: `ti2v-5B`
- Landscape: `1280*704`
- Portrait: `704*1280`
- FPS: 24
- Frame count: nearest valid `4n+1` count to the Hercules requested duration
- Native audio: **not supported by this runner**
- Text-to-video and one local image reference
- Local checkpoint directory only
- Local output path only

## Integrity

Each artifact records:
- Hercules render request fingerprint,
- Wan runner identity,
- pinned upstream commit,
- required checkpoint SHA-256,
- output SHA-256,
- task/size/fps/frame count.

## Not included

- No Wan source or model weights are copied into Hercules.
- No automatic model download.
- No cloud API.
- No native-audio claim.
- No silent provider fallback.

## Operational prerequisite

Before an actual render, the host still needs:
1. compatible NVIDIA/CUDA host,
2. separately installed pinned Wan2.2 checkout,
3. TI2V-5B checkpoint,
4. verified checkpoint checksum record (required by the runner),
5. Python dependencies from the upstream project.
