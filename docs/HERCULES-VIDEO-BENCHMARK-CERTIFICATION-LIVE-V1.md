# Hercules Video Benchmark Certification Live v1

## Verified state — 2026-09-28

SauceApproved Studio's live Hercules Video bridge now distinguishes benchmark render capacity from production render capacity.

### Certified benchmark renderer

- Provider: Hugging Face public ZeroGPU Space
- Space: `zerogpu-aoti/wan2-2-fp8da-aoti-faster`
- Model: `Wan-AI/Wan2.2-I2V-A14B-Diffusers`
- Protocol: Gradio queued call API
- Execution class: benchmark only
- Production capacity certified: false

### Synthetic proof

- Seed: `7182026`
- Duration: `0.5s`
- Inference steps: `1`
- Request fingerprint: `1782b9a98cbabfebb6c29843266dbd269d8f48639987b60d48f3699cf3a5e963`
- MP4 SHA-256: `3a34c36ccb9ab4275d2ad4a0e6fb450cd65a472a3ff6235955ede1e9d729a921`
- Artifact size: `71131` bytes
- Certification fingerprint: `98b72839d7faecd52821e0c310998237ace26e44e6735793f04f891db53bd74d`

The proof artifact is copied into private Hercules Storage before the temporary provider URL can expire.

## Security and truthfulness

- The certification endpoint consumes a one-time nonce.
- The provider host and artifact route are allowlisted.
- The returned file must have an MP4 `ftyp` signature.
- SHA-256 is computed from the actual bytes.
- Benchmark certification does not set production capacity ready.
- Studio continues to fail closed for production renders.
- No provider output, score, or artifact is fabricated.
