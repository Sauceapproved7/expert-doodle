# Hercules Video Open-Weight Runtime Selection — 2026-09-22

## Decision

**First integration candidate: Wan2.2 TI2V-5B.**

This is a runtime choice, not a change to the Hercules ownership boundary. Hercules remains the canonical orchestration, storyboard, routing, evidence, retry, and quality-control system. Model weights remain third-party components with their own licenses.

## Why Wan2.2 TI2V-5B is first

- The Wan2.2 model family is published under the Apache 2.0 license.
- The official project documents TI2V-5B text/image-to-video generation at 720p and 24 fps.
- The official project documents single-GPU operation on a GPU with at least 24GB VRAM using offload/dtype/T5 CPU options.
- The official CLI supports explicit output paths, prompts, seeds, frame counts, and checkpoint directories, making it suitable for a narrow runner wrapper without copying its implementation into Hercules.

Sources:
- https://github.com/Wan-Video/Wan2.2
- https://github.com/Wan-Video/Wan2.2/blob/main/generate.py
- https://huggingface.co/Wan-AI/Wan2.2-I2V-A14B
- https://huggingface.co/collections/Wan-AI/wan22

## Alternatives evaluated

### HunyuanVideo 1.5

Pros:
- 8.3B parameters.
- Official repository documents minimum 14GB GPU memory with model offloading.
- Strong consumer-GPU accessibility.

Constraint:
- Tencent's Hunyuan Community License excludes use in the EU, UK, and South Korea and includes additional hosted-service/disclosure/use restrictions. That makes it less attractive as the default Hercules commercial runtime even though the hardware floor is lower.

Sources:
- https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5
- https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5/blob/main/LICENSE

### LTX-2.5

Pros:
- Self-hosted synchronized video/audio capabilities.
- Current local tooling supports CUDA systems and local model execution.

Constraints:
- LTX-2.x uses a community license rather than Apache 2.0.
- Published terms require a paid commercial agreement for entities at or above $10M annual revenue.
- The main checkpoint is substantially heavier; LTX documentation describes higher-memory configurations, with local desktop support beginning around 16GB and training guidance substantially higher.

Sources:
- https://github.com/Lightricks/LTX-2
- https://github.com/Lightricks/LTX-2/blob/main/LICENSE-2_x
- https://huggingface.co/Lightricks/LTX-2.5
- https://github.com/lightricks/ltx-desktop

## Integration rule

Do not vendor or copy a model repository into the Hercules core.

A model runner must:
1. live behind `HerculesLocalVideoRunner`,
2. preserve its upstream license and notices,
3. use a pinned upstream release/checkpoint,
4. expose model identity/version in artifact metadata,
5. never change the generic Hercules render-request schema,
6. pass the Hercules Video test/provenance/security gates.

## Hardware gate

Before enabling Wan2.2 TI2V-5B on an actual host, Hercules must probe and record:
- GPU model,
- VRAM,
- CUDA version,
- driver version,
- free disk,
- RAM,
- checkpoint checksum.

If no compatible >=24GB CUDA GPU is available, the runtime must remain unavailable rather than silently falling back to a commercial provider.
