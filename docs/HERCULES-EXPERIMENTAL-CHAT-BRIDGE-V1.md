# Hercules experimental native neural compatibility lab

## Scope, quality and permissions

The project owns a very small native next-token model, `HerculesEmbeddedCoreNeuralV03`, attested as a **candidate**, not a consumer-grade chatbot. This experimental bridge makes the original candidate accessible via a carefully bounded, authenticated subset of two existing API shapes: `GET /api/tags` and `POST /v1/chat/completions`. It supports one SSE text delta and `[DONE]` so protocol compatibility can be exercised. It DOES NOT mean output quality is good, or that a genuinely conversational language model exists. It uses the most recent user input only, has no conversational memory, and never pretends to support Qwen or a production default model.

### Security contract

`GET /health` exposes only experimental origin and the fact that chat quality and public release are unverified. All inventory and text-generation requests require a bearer token of at least 32 characters; a session token is generated on process startup if none is provided and is never logged. Requests are bounded to 16KiB JSON, up to eight text messages and a 2048-character last user input. Generation is capped at 48 tokens. Unsupported methods, routes and models are refused. Empty output or engine errors produce sanitized 503, not a fabricated response. No prompt, token or engine stack traces are logged.

**No production coupling.** Production `hercules-mcp` still has an older deployed commit, defaults to `qwen2.5:7b` and calls an Ollama-compatible URL without a bearer header. This bridge requires authorization and an experimental ID; it **cannot be silently pointed at production**. Do not disable authentication to make it fit. Integration in a future isolated staging app would require explicit token-forwarding in the Python client and separate policy/quality tests, before any owner-authorized production cutover.

### Run tests

`node --test tests/hercules-experimental-chat-bridge.test.mjs`

The workflow also checks the original ownership, security and execution contract. Candidate training and response quality require a separate real model smoke test. No third-party packages or downloaded model weights are needed to start this prototype.

### Run isolated lab, not production

`HERCULES_EXP_CHAT_EXPERIMENT_ENABLED=true HERCULES_EXP_CHAT_HOST=127.0.0.1 HERCULES_EXP_CHAT_PORT=38902 node hercules-models/experimental-chat-cli.mjs`

The command refuses to bind unless `HERCULES_EXP_CHAT_EXPERIMENT_ENABLED=true` is explicitly provided. Set `HERCULES_EXP_CHAT_TOKEN` to an authorized secret if the service must be called from an independent staging application. Never publish the token or echo it in logs, never forward public unauthenticated user prompts to this model. A hosted lab should be configured as a separate service with autoDeploy off and provider free-plan quota reviewed; no paid infrastructure is mandated by this code.

## Product distinction

1. **Honest model inventory**: reports the actual experimental candidate ID rather than spoofing a more capable model family.
2. **Fail-closed quality boundary**: no generated text yields no fake assistant response, and health always reports `chat_quality_verified:false`, `public_release_approved:false`.

Original Hercules-owned source with AI assistance; no third-party model checkpoint is introduced. See launch blocker #909.

Model quality must be measured using actual decoded outputs in a controlled staging run; a passing protocol smoke test alone is not evidence of useful language understanding.

## Real native candidate sampling — October 13, 2026

GitHub Actions executed the original `HerculesEmbeddedCoreNeuralV03.load()` and sampled five fixed prompts (run `38407216996`). One produced zero tokens. Four produced up to 24 tokens, but examples were repetitive and did not answer the question `What is two plus two?`. These observations **fail the practical conversational-quality criterion**; successful checkpoint reconstruction and correct API protocol do not prove a usable general chatbot. The bridge is merged only as an opt-in experimental component, with no public-facing service or production AI activation authorized. A larger legally permitted language model or substantially better trained native model and independent task evaluations remain required for launch.
