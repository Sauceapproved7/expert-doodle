# Hercules Independent Diff Triage

This is a **deterministic, no-provider fallback** while Codex or an external LLM is unavailable. It does not bypass provider limits or impersonate a model-generated review. It adds independent evidence to an ordinary pull request, without starting a Render service, charging an inference provider, or requiring API credentials.

## What it verifies

- Reads only the proposed Git diff and flags selected changes that may need a human security or engineering review, including disabled TLS verification, broad workflow permissions, runtime evaluation, skipped tests and piped shell installers.
- Adds notice-level attention markers for sensitive directories (security, governance, financial, deployments, Shopify, Supabase) and explicitly labels binary or otherwise unparseable changes as incomplete.
- Writes only rule identifiers, sanitized paths, line numbers, counts, and a SHA-256 fingerprint of the diff to the GitHub job summary. Source lines and potential secrets are not echoed. No source is sent to an AI provider.

This tool is **advisory**. It cannot certify safety, run code analysis equivalent to CodeQL, provide generative repairs, or replace existing mandatory checks and approvals. An empty findings list is not a security certification. A SHA digest proves the identity of the input bytes, not completeness of inspection. Files at unusual paths and changes larger than the two-megabyte limit need another review route; the script fails closed on oversized diffs.

## Commands

The workflow `.github/workflows/hercules-independent-review.yml` runs on pull requests under read-only GitHub permissions. To run locally from a repository checkout with the base commit present:

```sh
BASE_SHA=$(git merge-base HEAD main)
HERCULES_REVIEW_BASE_SHA="$BASE_SHA" sh -c 'git diff --no-ext-diff --no-textconv --no-renames --unified=0 "$HERCULES_REVIEW_BASE_SHA" HEAD -- | node scripts/hercules-independent-review.mjs'
node --test tests/hercules-independent-review.test.mjs
```

Required existing gates still include `node scripts/verify-hercules-execution-contract.mjs`, `node scripts/verify-owner-code-only.mjs`, and `node scripts/security-baseline.mjs`. They are not disabled or replaced here.

## Ownership and provenance

Original Hercules code prepared with AI assistance, using Node.js built-in modules only; no third-party review engine, model weight, private code, or vendor dependency was incorporated. The tool is separate from Empire LLM for Codex and can operate without Codex, OpenRouter, or Render. It does not open a paid inference session or change the Shopify, payout, DNS, or production approval state.

The GitHub Actions summary intentionally omits raw added lines and any tokens that may appear in the diff. Reviewers must still inspect the actual pull-request changes before approval.
