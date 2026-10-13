# Hercules Smallz Read-only Evidence Command v1

## What this does

The first-party command \`node scripts/hercules-smallz-evidence-read.mjs --json\` composes the existing Smallz provider REST GET-only readers and the bounded release evidence bridge.

Its only destinations are the pinned GitHub main ref and two Render Smallz read endpoints. **It cannot deploy, disable auto-deploy, approve, roll back or change billing.** It is a local/server entry point, not a remotely accessible HTTP route or a scheduled background job.

## Credential custody

The command deliberately reads **only** two independently provisioned, server-side environment slots:

- \`HERCULES_SMALLZ_RENDER_READ_TOKEN\`: a Render API key supplied by legitimate existing server custody
- \`HERCULES_SMALLZ_GITHUB_READ_TOKEN\`: a GitHub token supplied by legitimate existing server custody

The tool cannot obtain these credentials from GitHub or Render by itself. The owner/admin must provision a minimal-read-scope token through an authorized integration. The **name** of an environment variable does not prove its token has read-only scopes; the provider's actual permissions require separate verification.

It **never** falls back to the write-capable \`HERCULES_RENDER_API_TOKEN\`, generic \`GITHUB_TOKEN\` or user-supplied command-line token strings.

If either configured value is absent, malformed, or unavailable, the command exits with a JSON HOLD status and **no network requests**.

## Execution and output

Command:

    node scripts/hercules-smallz-evidence-read.mjs --json

Only the optional literal flag \`--json\` is accepted. No URL, service ID, body, command or credential input is accepted from the CLI. Unsupported arguments cause a HOLD and zero provider fetches. No response writes files, caches a token, or stores customer data.

A successful three-source GET read may still return \`HOLD\` because live Smallz may be older than GitHub main, Render auto-deploy may still be on, and owner-authenticated runtime identity remains unobserved.

- Exit **0**: source records consistent but still UNATTESTED; **not** approval.
- Exit **2**: HOLD (missing credentials, provider read failure, mismatched commits or missing owner proof).
- All results keep \`executionAuthority=false\`, \`releaseApproved=false\`, \`ownerAuthorizationVerified=false\`, \`productionChanged=false\`. Provider exceptions and full raw response bodies are suppressed. A diagnostic result never confirms the source's independent identity if the reader's provenance is not verified externally.

## Testing and observed scope

- Initial RED \`2dcdc95b4a570a3f5e5fb4fe82bb1ba0a4e0bb83\`: expected missing-module failure; **112** previous Deploy Plane tests passed, one new suite failed.
- GREEN \`552b2b87a304cea8b10a23702e514b345b8dd613\`: **119/119 Deploy Plane tests pass**, including server credential missing/partial/invalid cases, sanitized failures, pinned GET-only requests and CLI output/flag rejection.
- This milestone has **not** executed token-backed production REST reads or a Smallz owner-authenticated browser request. No secrets were read through ChatGPT tools.
- Production Smallz still runs on the previously verified Render service commit; do not merge/release without resolving tracker [#1021](https://github.com/Sauceapproved7/expert-doodle/issues/1021).

No added npm packages, cloud instances, subscriptions, billing, provider permissions, environment settings or production deployments.
