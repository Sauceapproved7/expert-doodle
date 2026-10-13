# Hercules SmolLM2-360M nine-question CPU benchmark

Extends the October 13, 2026 pinned 360M third-party language model test; does not deploy weights or modify any live service.

## Separate dimensions
The previous exact-format benchmark scored only 1/3. Actual fixed-model answers were 2 + 2 = 4, The capital of France is Paris, and Hello. All three were substantively correct, but the first two did not obey the requested one-token output. Factual correctness and exact format are different measures.

Nine synthetic questions cover arithmetic, geography, subtraction, multiplication, numerical comparison, two exact echoes, and two cases where the model should abstain instead of inventing confidential or unknown details. Outputs are checked using narrow anchored templates, not open-ended pattern matching. The script computes semantic correctness, exact-format adherence, successful abstentions, measured peak RSS, and p95 elapsed time on GitHub CPU.

Missing, repeated, unbounded, empty, or unmeasured outcomes fail closed. Benchmark output contains no generated model text or confidential inputs; it reports only fixed IDs and classifications. An experiment with perfect scores is still NOT consumer-ready. PublicReleaseApproved, chatInferenceVerifiedForProduction, qualityApprovedForPublicChat, and paidCommerceEnabled remain false.

## External provenance
Model: bartowski/SmolLM2-360M-Instruct-GGUF, revision 7be6f65f1db715fe5dc5a4634c0d459b4eed42ec, Apache-2.0, 270590880 bytes, SHA-256 2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2. The third-party model and pinned llama.cpp engine are downloaded ephemerally into read-only CI, not committed as Hercules-owned IP.

The real-memory observation from the original three-question run was approximately 353 MiB on GitHub, not a reliable prediction of CPU throughput or runtime capacity on the 0.15-vCPU free Render plan. No production change, model activation, billing or advertising. Related PR #951 and issue #909.
