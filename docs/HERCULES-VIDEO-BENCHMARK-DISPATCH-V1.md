# Hercules Video Benchmark Dispatch v1

## Purpose

Expose a real, owner-authenticated benchmark render path from SauceApproved Studio while production video capacity remains fail-closed.

## Live behavior

Endpoint:

`POST /functions/v1/hercules-preview-cell/video/render`

Required:

- authenticated SauceApproved owner/admin;
- `mode: "benchmark"`;
- duration <= 0.5 seconds;
- 480p request class;
- 16 FPS;
- deterministic seed;
- one HTTPS image reference from an allowlisted source.

The dispatcher selects only the certified benchmark adapter:

`hf-public-zerogpu-fast-wan22-i2v`

## Job evidence

Each accepted benchmark render creates an idempotent `hercules_execution_jobs` record with:

- workload type `video.render`;
- execution class `benchmark`;
- provider adapter ID;
- trace ID;
- canonical Hercules request fingerprint;
- final artifact SHA-256;
- private Hercules Storage path;
- explicit `benchmarkOnly=true`;
- explicit `productionCapacityCertified=false`.

## Security

- Anonymous requests are rejected with HTTP 401 before job creation.
- Production mode does not fall back to the benchmark adapter.
- Image inputs are restricted to the SauceApproved Supabase host or the Gradio public test source used for synthetic certification.
- Returned bytes must contain an MP4 `ftyp` signature.
- Output is copied into private Hercules Storage before success is recorded.
- No artifact, provider response, or success state is fabricated.
