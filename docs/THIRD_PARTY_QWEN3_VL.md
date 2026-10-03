# Third-party notice — Qwen3-VL-4B-Instruct evaluator

Hercules Video contains an optional local evaluator wrapper for the separately installed Qwen3-VL-4B-Instruct model.

- Upstream project: https://github.com/QwenLM/Qwen3-VL
- Weight repository: https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct
- Upstream project license: Apache License 2.0
- Weight repository license: Apache 2.0
- Qwen-VL utility package: https://github.com/QwenLM/Qwen3-VL/tree/main/qwen-vl-utils

Hercules does not vendor Qwen model weights in this repository and does not automatically download them.

The evaluator requires a local model manifest that records the exact local model files, byte sizes, SHA-256 hashes, model revision, and license. Hercules verifies that manifest before evaluation.

The local Python worker uses the documented Qwen3-VL Transformers interface and local video input support. It runs with Hugging Face/Transformers offline environment flags and local_files_only=True.

Any redistributed upstream Qwen code or model assets must retain their applicable Apache 2.0 license and attribution notices.
