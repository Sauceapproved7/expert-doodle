# Glow Society — standalone beauty prototype

A free-to-run, dependency-free, responsive HTML/CSS/JavaScript concept app. Designed to foreground Black women's beauty while welcoming everyone. This app is isolated in `apps/glow-society/` on a dedicated Git branch and does not modify any existing SauceApproved/Hercules production app.

## What works

- Mobile-first beauty exploration: **47 fictional demo looks** across lips, blush, eyes, natural/protective hairstyles and nails.
- Complexion-depth and warm/cool/neutral/olive undertone filters for makeup. Existing looks include deep and rich skin shades.
- Private favorites, multi-category saved looks, locally created posts, comments and likes, follow preferences.
- On-device camera AR: approximate MediaPipe face-landmark lip and cheek overlays; approximate MediaPipe hand-landmark nail overlays. Only activates after the user taps **Start camera**. Camera stops on page hide or navigation.
- Photo lab: user-controlled image file stays in the browser memory, with draggable manual colored overlays for lips, eyes, cheeks, hair color concepts, and nails.
- Artists directory; deliberately fictional demo profiles and no public booking actions.

## Important limitations

- **Not an ecommerce site.** Sample names, creator identities, endorsements, prices and results are fictional, and there is no checkout, inventory, payment, or real salon bookings.
- **Not a public women's social network yet.** Posts/comments/likes/follows are local browser demo data only. Public accounts require authentication, moderation, reporting, abuse prevention, and consent/privacy policies.
- **Not accurate product fitting or shade matching.** AR lip/cheek/nail placement is experimental and should be validated across deeper complexions, skin lighting and device cameras. Hair is manual color/concept placement, not live hairstyle replacement. Nail hand landmark ellipses are not salon-accurate nail geometry.
- Privacy: uploaded face/hand photos are held only in browser memory and not uploaded by the app. Favorites and posts use localStorage in this browser. The sample photo and the AR model/runtime assets load from external CDNs, which receive ordinary asset requests; live frames do not get posted by application code. The external model files are not self-hosted.
- Camera requires HTTPS and browser permission, and may fail on some phones.
- The name **Glow Society** is provisional and not cleared for trademark use.

## Run and verify

Serve this directory over localhost or HTTPS (for webcam access). No dependencies or credentials are needed.

```sh
node --check app.js
node test.mjs
python3 -m http.server 4173
```

Then open http://localhost:4173. For iPhone live tracking, use HTTPS hosting rather than a plain HTTP LAN URL.

## Test status

The static test checks JavaScript syntax, required navigation, referenced DOM IDs, and privacy messaging. It does **not** replace real-camera visual and landmark tests.

## Deployment

Render Static Site may use:
- Repository: `Sauceapproved7/expert-doodle`
- Branch: `feature/glow-society-standalone-v1-20261013`
- Build: `node apps/glow-society/test.mjs`
- Publish directory: `apps/glow-society`
- Optional environment: `SKIP_INSTALL_DEPS=true`
- Auto deploy: **off** to prevent unreviewed changes.

Do not point an existing live service or domain at this branch.

## Privacy vault and community safety demo

- The Saved view has a **device-only privacy vault**: export an archive of Glow Society `localStorage` records to JSON or erase those records after a separate confirmation. Export includes private posts and personal preferences; handle the downloaded file as private. Neither export nor erasure communicates with an account backend.
- Erasure targets only keys prefixed `glow-society-v1-` so storage owned by other apps sharing an origin is left intact. It also clears in-memory saved looks and favorites, cancels the camera, and revokes any user-uploaded photo URL.
- Example creator muting and unmuting operates locally for fictional sample profiles. Hiding/muting is **not** reporting to an external moderation service. No public safety or moderation claim is made.
- Client/browser QA verifies the confirmation and cancel controls, Blob export, storage scoping, current-session reset, and mute/unmute behavior.
- No real users, public profiles, moderation queue, user reporting endpoint, account deletion service or cross-device sync are present.

## Landmark diagnostics (session only)

The Studio's **Landmark session diagnostics** panel observes only the number of processed face/hand frames, number with detectable landmarks, average model-detection time and approximate sampling frequency. It runs **only after Start camera** is granted and the model begins tracking.

- No photos, camera frames, biometric landmarks, device identifiers, location or account credentials are collected or exported by this diagnostic. Metrics remain in page memory, are cleared when Glow's local data is erased and are never sent to a Glow backend.
- The report is downloadable as `glow-society-ar-session.json` once at least one frame has actually been sampled. The export uses a local Blob.
- Fewer than 30 samples are marked `insufficient-samples`; larger samples are marked `observational-only`. These counters can reveal video pipeline behavior, **not** overlay fit, color correctness, skin-tone fairness, nail geometry, real-device reliability or a public launch gate.
- Live third-party MediaPipe runtime/model resources may still emit standard asset/CDN requests and MediaPipe SDK usage telemetry as disclosed in the Studio. The diagnostic adds no telemetry.
- Node contract tests verify sample counting and absent fake certification. Chromium tests verify no fabricated metrics before a session starts.

## Inclusive AR field observation kit (optional)

The Studio contains a six-scenario test matrix for observing face/lip/cheek overlays and nail concepts on a **real physical device** in daylight, warm indoor light, mixed light, and movement. It calls out deep/rich complexions and darker hands explicitly, without treating one result as representative of all Black women or all skin tones.

- Every scenario initially displays **Not tested**. It becomes selectable only after the browser has processed at least one camera frame with a matching face or hand model. A test result is a person's **self-reported observation**, not independently verified.
- A user can mark **Appears aligned** or **Needs review** and choose **Export observation report**. The exported JSON contains fixed test scenario names, self-reported outcomes and aggregate counts/timing for sampled modes. It never contains images, coordinates, name, account, location or device identifier.
- This report lives only in the current page session until explicitly downloaded; it is not stored in Beauty Passport, sent to the server, or synced. The Reset button clears observations, and Glow's confirmed local-data erasure also clears all session metrics and observations.
- Reports cannot certify model fit, facial features, shade fidelity, gender representation or physical-device performance. A human must actually inspect a real iPhone and other devices under diverse lighting to make release claims.
- For any potential public launch, a separate documented opt-in device test protocol, accessibility and accuracy audit across diverse complexions, third-party SDK telemetry review and independent results would still be necessary.

## Beauty Match — chosen-preference discovery

The Explore view now includes a tag-based Beauty Match selector with category, skin depth, undertone, hair preference and optional soft/statement style direction. It is built for deep and rich skin beauty discovery and natural or protective hair, while letting people skip any field.

- All results come from **47 fictional catalog concepts**; the engine does not call a network service, read a photo, inspect face or hand landmarks, collect protected traits, or infer identity.
- Skin depth and undertone tags apply only to makeup; hair texture preferences apply only to hair. Nail styles are included for inspiration **without claiming they match a skin tone**. When tags do not match, the app shows an honest no-results state rather than claiming the wrong shade is appropriate.
- Suggestions give a short **Why shown** explanation based on the matched tags or descriptive style keywords, with working favorite and manual/photo try-on actions.
- Choices live only in this page session. Visitors can load saved Beauty Passport filters deliberately, but a Beauty Match is not saved automatically, uploaded to a server, or added to the Passport. The Clear and private-data erasure actions reset the wizard.
- Discovery tags are editorial and not scientifically validated color calibration; deep-complexion users should verify real shades under appropriate lighting before a purchase. No purchase is offered here.
- Node tests check depth and undertone exclusions, 4C hair options, cross-category concepts, safe no-results behavior and nonmutation. Browser checks cover interaction and erasure.

## Supplier Catalog Intake Workshop — review-only foundation

The Explore page has a collapsed, optional workshop for inspecting supplier product data from a local JSON file (up to 64 KiB and 30 rows). This is infrastructure for **future real catalogs**, not an active supplier connection.

- Supported schema is `{"schemaVersion":1,"products":[{"sku":"...","brand":"...","name":"...","category":"makeup|hair|nails","sourceUrl":"https://...","tags":["deep"]}]}`. Download the fictional example from the page for the exact structure.
- Strict checks reject duplicate SKUs, unexpected fields (including price, inventory, image and fake approval attributes), missing brand/name, invalid categories/tags, unsafe source URL schemes and local/private-origin host references. Only HTTPS references pass structural checks; the app **does not fetch or validate who controls them**.
- Schema-valid rows appear only as **source unverified, owner approval required, not for sale** in a separate text-only review. They are never merged into the 47 fictional demo concepts, Beauty Match, checkout, public inventory, saved looks or any server database.
- File contents are parsed in the visitor's browser, held in page memory, and never uploaded. URLs are rendered as text, not active links. The workshop also supports one explicit fictional demonstration and an offline-downloadable JSON example.
- Clear Review or confirmed local-data erasure clears the workshop and any selected file. Normal page unloading also discards parsed candidates. No account creation, API token, subscription, supplier integration, checkout, advertising, automatic pricing or recurring cost is added.
- To connect real products in the future, independent supplier/provenance authorization, accurate feed updates, rights/terms, product compliance and freshness checks, and explicit owner approval are still required. A pasted `sourceUrl` or internally successful test is **not** sufficient proof of catalog authority or inventory.

Unit and Chromium tests verify input bounds, unsafe URLs and metadata, duplicate SKUs, explicit unverified status, no storefront pollution and browser-local deletion.

## Supplier provenance review packet — not a license or approval

After reviewing a local supplier feed, the browser now shows an offline evidence tracker for each structurally acceptable candidate. Its five required topics are supplier identity, resale authorization, creative/media rights, cosmetic labeling/claim compliance and catalog freshness. Each topic can be marked `Evidence not supplied`, `Evidence claimed (unverified)` or `Conflict / needs review`.

- **All outcomes are unverified.** Selecting an option does not inspect a URL, contact a seller, validate legal rights, accept a policy, authorize an order, turn on payouts, move candidates into public discovery, or change product status.
- **Download unverified review packet** creates a local JSON summary containing candidate identifier, brand, name and five fixed checklist states. It always records `independentVerification: not_performed`, `ownerApproval: not_granted`, `approved: 0`, `published: 0` and `releaseEligible: false`. No photos, source documents, private contact details or credentials are included.
- Review choices are *in-memory only* and scoped to the current feed. Loading a new feed, using Clear Review, or confirming Glow's local-data erasure discards them. No server calls, persistent supplier records or new costs are introduced.
- Authentic supplier verification, written licensing and intellectual-property permissions, product/claims compliance, source freshness and owner approval are **separate, unfinished external gates**. This worksheet prepares questions; it does not satisfy those gates.

A Node contract test proves that even all evidence marked as claimed cannot authorize publication, and browser QA verifies the unverified download, candidate isolation, reset and erasure behavior.

The supplier evidence panel also displays a live missing/claimed/disputed tally and checklist coverage. This is an organizational progress indicator only; it does not independently verify a single claim or move any product toward release eligibility.

The review summary suggests the next non-authorizing action: resolve disputed evidence first, then request missing documentation, then independently verify claimed material. It never treats a completed checklist as approval.
