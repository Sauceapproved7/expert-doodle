# DA-45 — Qwen 1.5B owner-host private boot (not production)

**Scope:** First-party, opt-in **private** host launcher for the exact SHA256-pinned Qwen2.5-1.5B-Instruct Q4_K_M model, using existing Hercules \`createLocalChatAdapter\` and \`listenModelPlaneService\`. It starts no cloud machine and does not cost money by itself. The cloud machine and Qwen weights must already exist on an independently verified authorized host. No provider secret is required in the repo.

**Verified on previous temporary public GitHub ARM64 runner:** Qwen 1.5B 27 actual responses had 9/9 baseline semantic and exact-format; 18/18 system-guided substantive but 17/18 exact-format (answered \`OK.\` not byte-exact \`OK\`), 1,096,384,512 bytes high-water process RSS, p95 3032 ms. This still does **not** qualify commercial/production public release.

**Before private trial:** Owner must have (1) a permitted, independently checked ARM64 host with minimum 2 CPUs, >=4 GiB physical and >=2 GiB currently available RAM; (2) legitimate host billing status, spending limit and owner-controlled credentials established independently; (3) locally built pinned \`llama-server\` binary corresponding to upstream commit \`d81235049384534c167caea52b85a694f6103d14\`; (4) **locally installed** model \`Qwen2.5-1.5B-Instruct-Q4_K_M.gguf\` checksum \`1adf0b11065d8ad2e8123ea110d1ec956dab4ab038eab665614adba04b6c3370\` from licensed Apache-2.0 upstream; (5) owner-issued strong secret bearer token in local environment. The script checks actual model file hash, executable access, CPU architecture/count, RAM. It cannot independently establish actual provider billing or legal host ownership.

With those prerequisites, the owner-host environment may invoke the bootstrap with the following variable names (do not paste real secret values in chat):

\`\`\`text
HERCULES_QWEN15_PRIVATE_TRIAL=true
HERCULES_QWEN15_MODEL_FILE=/absolute/path/to/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf
HERCULES_QWEN15_LLAMA_SERVER=/absolute/path/to/pinned/llama-server
HERCULES_MODEL_TOKEN=(strong owner-only bearer secret, >=32 characters)
\`\`\`

Execute \`node scripts/hercules-qwen15-owner-host.mjs\` **on the authorized ARM64 host only**. It never downloads a model, changes DNS, creates subscriptions or changes live services. It binds the pinned inference engine to **127.0.0.1:18776** and Hercules bearer-authenticated API to **127.0.0.1:38900**; no TCP listener is public. The \`/health\` of the native inference engine indicates startup only. Hercules \`/health\` reports no model-quality approval. The protected endpoint \`POST /v1/chat\` must be invoked with the owner secret, and **does not** signify \`productionInferenceVerified\`. Nothing automatically connects it to production Supabase Devbrain or public registration.

The short synthetic 27-question benchmark itself remains insufficient for full customer traffic: further security, privacy, concurrency, rate-limit, uptime, failover, sustained load and live authenticated routing tests and explicit owner approval are necessary. No fake Devbrain green, auto-enrollment, checkout/payout/domain change, Render/Railway restarts, or main-branch merge.

This proposed code resides only in isolated stacked PR #1007. Existing production remains unchanged.
