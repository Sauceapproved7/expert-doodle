# SauceApproved Kids Studio v2

SauceApproved Kids Studio v2 upgrades the existing parent-operated family story planner at `/kids` without changing its local-first trust boundary.

## Creative system

The three original kits remain:

| Kit | Core Hercules additions |
| --- | --- |
| Neighborhood Hero | Choice Compass and Courage Replay |
| Dream Director | Beat Board and Role Swap |
| Time Capsule | Then / Now and Privacy Check |

V2 adds a shared creative direction layer across all three kits:

- **Storyboard Deck** — converts the reviewed plan into three visual scene cards.
- **Camera Coach** — adds simple family-friendly framing guidance.
- **Sound Map** — plans voices, room sound, silence, or family-owned/permitted music without recording or uploading audio.
- **Transition Lab** — previews four visual transition styles on the Storyboard Deck while honoring reduced-motion preferences.
- **Parent Cut Lock** — requires four explicit parent/guardian checks plus a fresh preview before local export.
- **Mood-to-Motion Map** — combines story energy, framing, sound, and transition choices into one readable direction card.

Parent Cut Lock and Mood-to-Motion Map are SauceApproved/Hercules differentiators. No claim is made that competing products lack comparable features.

## Parent-operated review

The required review checks are:

1. the operator is the parent or guardian;
2. the draft was checked for names, contact details, and private locations;
3. permission exists to film everyone who will appear;
4. the parent decides whether, where, and with whom finished media is shared.

Any creative or review change invalidates the previously approved export state. The plan must be previewed again before it can be downloaded.

## Privacy and execution boundary

V2 preserves the v1 boundary:

- no child account;
- no server upload;
- no public posting;
- no cloud generation;
- no media storage;
- no automatic handoff of the draft to the camera;
- server mutations remain fail-closed;
- the text plan exists in browser memory until the parent explicitly downloads it to the device.

The Privacy Check catches obvious email addresses, phone-like numbers, URLs, and common street-address patterns. It is an assistive check, not a substitute for parent review or legal review.

## Provenance

The v2 implementation is original SauceApproved/Hercules project code created with AI assistance under the repository's existing ownership and provenance controls. It adds no third-party runtime source, copied assets, fonts, binaries, media, or vendor dependency tree. Browser-standard APIs and Node.js/GitHub Actions infrastructure remain external technologies governed by their own terms.

## Verification

Focused gate:

```sh
node --test tests/sauceapproved-kids-studio.test.mjs tests/hercules-video-studio-server.test.mjs tests/hercules-video-studio-contract.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/security-baseline.mjs
```

CI: `.github/workflows/kids-studio.yml`.

Commercial and deployment gates remain separate. This implementation does not authorize paid launch, child registration, public media publishing, or collection of child data.
