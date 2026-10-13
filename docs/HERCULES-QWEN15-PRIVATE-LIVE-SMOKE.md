# DA-45 — Live private-host integration evidence (GitHub ARM64 only)

This optional evidence step runs the **existing first-party owner-host launcher**, not a demo imitation, on the same native ephemeral ARM64 runner already used for the 27-response Qwen1.5B benchmark. It reuses the checksum-verified model and pinned compiled llama.cpp engine. No extra machine, paid host, new network endpoint or credentials from any customer's vault.

The existing independent benchmark job continues to collect its nine + eighteen synthetic responses. Once it kills its local model process, a second step starts the real \`scripts/hercules-qwen15-owner-host.mjs\` with the opt-in gate explicitly set, preinstalled model and engine paths, and a fresh **ephemeral, never printed** test-only owner bearer secret.

The private integration smoke checks through actual HTTP calls to **127.0.0.1:38900**:
- unauthenticated and incorrect bearer tokens both produce HTTP 401;
- an authenticated empty prompt produces HTTP 400;
- bearer-only readiness exposes loopback-only llama.cpp with false release flags;
- a valid bearer call reaches the Qwen model and returns \`4\` for a fixed \`2 + 2\` task;
- health identifies the Hercules model plane without asserting public admission;
- no credential appears in the launcher log.

Every missing result, wrong answer, unexpected 2xx for invalid authorization, transport error or timeout fails the private smoke. Source and tests stay isolated on stacked PR #1010, and do not add vendor code, proprietary weights, model ownership claims or subscription requirements.

**Scope limit:** Passing is evidence of a *temporary test-runner private sidecar* only, not verified continuous availability, cost, ownership, provider billing, secure remote access, concurrent load, access control through Supabase Devbrain, commercial inference or public ChatGPT-style service. The bootstrap and evidence always leave \`productionInferenceVerified\`, \`publicReleaseApproved\`, \`aiDevbrainHealthy\`, and \`paidCommerceEnabled\` false. No changes to Render, Railway, Shopify, Stripe, DNS, Supabase, existing paid plans, or main-branch auto-deploy services.
