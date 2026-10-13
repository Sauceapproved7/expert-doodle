# Hercules Vault source-grounded answerer (research-only)

The current original small neural model is not a viable general-purpose chatbot. Rather than pretending otherwise, this original Hercules component searches only selected locally bundled technical Markdown docs with the existing Hercules native sparse text retriever. It returns exact document excerpts, their filename, line spans, and SHA-256 of the original file. It **never generates novel prose**, executes commands from documents, approves releases, or claims independent factual verification.

## Source boundaries and accuracy

Allowlisted files are the five explicitly named technical `docs/HERCULES-*.md` files in `hercules-vault/control-cli.mjs`. They are repository-authored records, *not* independent outside verification or private vault documents. No user-directed path, URL, Google Drive, Dropbox, personal files, private credentials or file uploads are ingested. Ingestion fails closed on duplicate, unsafe, oversized, empty or secret-shaped content. The excerpt SHA-256 supports byte-level provenance and line ranges identify the selected evidence. Runtime startup fails if any expected document is absent.

Unknown questions, including outside topics, yield `found:false` with empty sources. The ranker requires at least two shared normalized content words and a positive native sparse similarity, rather than guessing from unrelated text. Returned snippets are direct excerpts and might be inaccurate or stale; a separate real-world corroboration task remains required before consequential changes.

## API and security

- `GET /health`: public minimal diagnostic only, always reports `general_chat_verified:false`, `public_release_approved:false`.
- `POST /v1/vault/ask`: an authenticated bounded JSON `{"query":"..."}` request. Returns `response_type:source_excerpt`, exact source and line SHA-256 when found. No private index enumeration or model spoofing.
- A >=32-character bearer token is required. The server generates an unlogged random session token unless an authorized secret is provided via `HERCULES_VAULT_ASSISTANT_TOKEN`. No token is included in response or process logs.
- Prompt body maximum 12KiB, question maximum 512 characters; all responses are JSON and `Cache-Control: no-store`. Unknown paths denied. Prompts are not persisted or logged.

Start locally in an **explicitly authorized isolated research environment**:

`HERCULES_VAULT_ASSISTANT_ENABLED=true node hercules-vault/control-cli.mjs`

Do NOT attach it to the live `hercules-mcp` chat endpoint, iPhone public preview, or storefront. It is not Ollama-compatible and no public promotion is authorized. An isolated Render deployment needs a separately configured owner-approved secret and provider quota review.

## Quality and owner-controlled release gates

`node --test tests/hercules-vault-source-assistant.test.mjs`

GitHub workflow `.github/workflows/hercules-vault-source-assistant.yml` runs focused tests and ownership/security/contract checks. Only after passing a source-attribution benchmark and staging authentication review should a standalone owner-controlled internal UI be considered. Never treat this as a verified general AI model.

## Two original differentiators

- SHA-256 **per source document**, precise line spans and no paraphrased hallucinations.
- A **no-evidence response** rather than a fabricated completion or unchecked public launch claim.

Original Hercules/SourceApproved project-owned implementation with AI assistance, Node standard library, and existing first-party project native-retrieval implementation. No external dependencies, copied model weights or new rights grant.

## Release limitation

The returned snippets describe what checked-in Hercules documents **say**, not independently established external facts. No automatic action is permitted based solely on a retrieved snippet, and no signed-in consumer AI account is created or enabled.

## Independent CI evidence

The focused GitHub test covers exact source excerpts, SHA-256 and line spans, corpus safety, denied unauthenticated requests, oversized inputs, unknown-question fallback, and the five actual allowlisted documentation files. Public distribution and general AI inference remain unverified.
