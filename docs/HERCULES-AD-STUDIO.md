# Hercules Ad Studio v1.0

Personal-use, offline-first ad preparation workspace. Open `hercules-forge/ad-studio/index.html` directly in a modern browser. No install, package manager, server, API key, or external network access is required by the app. A browser that opens HTML as text must instead serve this file through the existing authenticated Hercules surface.

## Delivered

- Three template-generated editable messaging angles from an offer, audience, problem, benefit and evidence.
- Creative concept preview and original canvas-rendered 1080×1080 PNG export, with overflow refusal rather than silently cutting copy.
- Creative/video brief, campaign JSON export, clipboard copy with fallback explanation.
- Budget allocation planner and HTTPS UTM builder that preserves other URL parameters.
- Manual experiment ledger with weighted aggregate spend, conversions, CPA and ROAS; CSV export neutralizes formula prefixes.
- Device-local saved campaigns, reopen, delete, backup and validated import as separate copies.
- Responsive layout, native labelled fields, keyboard focus, status announcements, unsaved-edit unload warning.

The initial offer is based on the current Revenue Recovery marketing implementation handoff: founding pilot, synthetic invoice demonstration and controlled follow-up. Example copy must be reviewed before use. No invented testimonials, guarantees or fabricated performance data are included.

## Run and verify

From the complete repository, first run the mandatory owner-code gate:

```
node scripts/verify-owner-code-only.mjs
node --test tests/hercules-ad-studio.test.mjs
```

The eleven focused tests cover template bounds, arithmetic, zero denominators, malformed numeric inputs, budget limits, UTM preservation and unsafe URLs, backup validation, CSV escaping and standalone source syntax. They passed in the implementation workspace on 2026-09-27.

A full-browser smoke test was attempted but could not execute because this workspace had no installed Chromium binary. Therefore visual/browser workflow verification is outstanding. The complete repository was not locally cloned (git transport lacked credentials); repository-wide gates must run through CI before merge. No claim of full regression certification or production deployment is made.

## Data and integration boundaries

- Data is stored under localStorage key `hercules-ad-studio-v1`; storage is device/origin specific and not encrypted. Do not put secrets or customer invoice records in campaign fields.
- Save is explicit; a storage error is surfaced. Export workspace includes the current campaign, including when persistent browser storage is unavailable.
- Deleting a campaign removes the stored copy; a loaded working copy can be saved again.
- Channel selection labels plans and creative briefs. It does not implement platform-specific API publishing, platform character-limit validation or delivery optimization.
- Copy generation is deterministic template code, not an attached AI model. Creative exports are typography-based graphics, not generated photography.
- Results are manually entered; there is no connected analytics feed, conversion tracking pixel, attribution engine or statistical winner selection.
- This standalone surface is not yet linked into the deployed Hercules navigation, authentication or release pipeline. Existing platform access/release gates must be preserved when integrating.
- No ad publishing, audience upload, external communications, billing, payments or spend actions exist in this edition.

## Provenance

Original implementation created 2026-09-27 at the user's request, with OpenAI coding assistance. Files: `hercules-forge/ad-studio/index.html`, `tests/hercules-ad-studio.test.mjs`, and this document. No copied third-party code, imagery, fonts, SDKs or runtime packages. Browser APIs are external infrastructure. Existing repository license and IP_PROVENANCE.md continue to govern; no license or legal ownership transfer is implied. Commit and pull-request history identify the exact source and review record.
