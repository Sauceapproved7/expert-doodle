# Hercules AI Core

Self-hosted AI runtime owned and operated by SauceApproved.

## Properties
- Local-first: works with an Ollama-compatible local model server.
- Provider-optional: no ChatGPT subscription is required.
- Persistent: conversations are stored on an owner-controlled Docker volume.
- OpenAI-compatible HTTP surface: `POST /v1/chat/completions`.
- Fail-closed configuration: remote providers are not enabled implicitly.
- Replaceable model layer: model/provider can change without replacing Hercules.

## Start
1. Install Docker.
2. From this directory run: `docker compose up -d --build`
3. Pull a local model: `docker exec hercules-ollama ollama pull qwen2.5:7b`
4. Check: `curl http://localhost:8080/health`

Data persists in the `hercules-data` and `ollama-data` volumes.

This repository contains the Hercules orchestration/runtime code, not proprietary OpenAI model weights.
