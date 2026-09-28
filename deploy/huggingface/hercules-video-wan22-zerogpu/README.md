---
title: SauceApproved Hercules Video · Wan2.2 ZeroGPU
emoji: 🎬
colorFrom: black
colorTo: gray
sdk: gradio
sdk_version: "5.49.1"
app_file: app.py
pinned: false
license: apache-2.0
---

# SauceApproved Hercules Video ZeroGPU Renderer

This is a **replaceable rendering backend** for Hercules Video. It is not the SauceApproved product brain.

## Contract

The Gradio API endpoint is `/generate` and accepts one JSON string containing the canonical Hercules schema:

`sauceapproved.hercules.video-render-request`

The response is:

1. the generated MP4 artifact;
2. a structured evidence object with the request fingerprint, model reference, seed, SHA-256, dimensions, FPS and duration.

## Model

External model dependency: `Wan-AI/Wan2.2-TI2V-5B-Diffusers` (Apache-2.0).

Hercules does not relicense or claim ownership of external model weights. Third-party rights remain with their respective rights holders.

## Runtime boundary

This Space is intended for Hugging Face ZeroGPU benchmark use. Hercules Studio, routing, continuity, quality gating, provenance, and final acceptance remain outside this Space in SauceApproved-owned infrastructure.

The renderer deliberately supports only 720p, 24 FPS, 16:9 and 9:16 in v1. Free benchmark clips are capped at 3 seconds / 73 frames with a 180-second GPU slot. Unsupported requests fail closed.
