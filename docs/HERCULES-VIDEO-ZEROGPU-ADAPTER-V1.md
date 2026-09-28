# Hercules Video ZeroGPU Adapter v1

## Purpose

Provide a replaceable benchmark renderer for SauceApproved Studio without moving orchestration, routing, quality gates, continuity, acceptance, or evidence ownership out of Hercules.

## Architecture

`SauceApproved Studio -> Hercules Video bridge -> HerculesHuggingFaceZeroGpuAdapter -> Gradio Space -> Wan2.2 TI2V-5B -> artifact/evidence -> Hercules quality gate`

The adapter uses plain HTTP against the Gradio API. No Hugging Face SDK is introduced into Hercules Video core.

## Registration rule

Do **not** add a provider to `hercules-video/provider-registry.json` or the live execution adapter registry until all of these are true:

1. the Space URL is owner-authorized;
2. `/gradio_api/openapi.json` is reachable;
3. the configured `/generate` endpoint exists;
4. one synthetic render completes;
5. the returned artifact SHA-256 and Hercules request fingerprint are verified;
6. no secret appears in logs, request bodies, descriptors, or artifacts.

Until registration succeeds, Studio remains fail-closed with `no_certified_video_renderer_online`.

## Free-tier role

ZeroGPU is a benchmark/development renderer, not a production-capacity guarantee. Hercules must treat quota exhaustion, queue delay, suspension, or provider unavailability as renderer unavailability rather than as a successful render.

## Ownership and third-party rights

The adapter, request schema, evidence contract, routing, quality gates and Studio integration are SauceApproved-owned code.

The Wan2.2 model weights and third-party libraries remain external dependencies under their own licenses. The deployment package references those dependencies; it does not vendor their source or model weights.
