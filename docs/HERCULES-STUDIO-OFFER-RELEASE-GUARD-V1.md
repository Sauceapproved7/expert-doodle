# Studio offer source-bound publishing guard — v1

## Rationale
The existing deployed Hercules `hercules-deploy-controller` v10 has an authenticated `deploy_static` path, but it writes the public Storage file before verifying the public URL. Its older verification accepts arbitrary HTTP 200 HTML without confirming the file is exactly the approved release. On Render free instances a temporary 503 is possible while cold starting. A failed verification could therefore leave unverified public HTML online.

## Verified baseline
- Production source snapshot: `hercules-deploy-controller` Edge Function v10, provider bundle SHA-256 `c2e205b525e58a699ad93ad4d21ed8259bb63d7507542df3eb3e73a234cff805`.
- Approved GitHub Studio founding-access HTML (9,441 UTF-8 bytes), SHA-256 `8743e3ffc127f61d48aa9d2eb9058847e32b2ff51489367d2f59f3b54ef23a9b`.
- Current live offer (7,889 UTF-8 bytes), SHA-256 `bf087ccd55cfbe172c049b1d1db5882aeac2cac73aa33fec1839c951c1fc41ff`.
- Distinct Studio **app** remains separate at slug `sauceapproved-studio`; never overwrite it.

## What this patch changes
The v10 controller has been snapshotted in `supabase/functions/hercules-deploy-controller/index.ts` as current production evidence, with a **strictly reversible, localized patch**:
- Imports one owned, dependency-free helper, `studio-offer-release-guard.mjs`.
- Uses the helper **only** for authenticated `deploy_static` requests whose slug is exactly `sauceapproved-studio-offer`.
- Requires the request to supply `approved_sha256` **and** `previous_sha256`, both exactly matching the pinned expected digests. Invalid, altered, missing, unexpected, or unapproved source fails before public Storage writes.
- Reads the current published object and verifies its digest before the first public write; returns a revision-conflict failure if it has changed.
- After the normal deployment archive writes, performs the same Storage upsert **only inside the existing authorized controller** and performs up to three bounded GET attempts of the exact public Render address, retrying only temporary HTTP 503. Only a 200 HTML response with a full matching digest counts as success.
- If verification fails, attempts to restore the exact previously observed public object; it checks the current object's digest first and verifies Storage restoration afterwards. An indeterminate or failed rollback remains explicitly failed.
- Existing `internal(req)`, `actor(req)`, membership role checks, build policy, credential handling, logging and all other deployment targets are preserved by the patch; there is no new unauthenticated uploader.

## Tests and limitations
Run `node --test tests/hercules-studio-offer-release-guard.test.mjs`. Eight tests include exact SHA, invalid source, 503 retry, non-HTML content, redirect, incorrect public content, original-byte restoration, intervening changes, failed restoration, and owner-gate wiring. Existing GitHub audit tests remain independent.

**This is a best-effort, per-request rollback—not an atomic compare-and-swap or distributed lock.** Concurrent authorized updates can race between reads and writes; a process termination after an upsert may prevent any rollback attempt; restoring Supabase Storage does not immediately prove every CDN or browser cache displays the old bytes. A failed deployment must trigger independent public Storage + Render checks before retrying. The immutable rollback HTML also exists in prior GitHub Actions artifact 11948538661. Do not interpret a 500 controller status as proof that no Storage write occurred.

**This code is not by itself a successful or approved production deploy.** Publishing the updated Studio offer still requires a genuine authenticated owner/admin/internal release operation, reviewed release state, safe backup, and verified post-publish parity. Do not fabricate customer requests or open paid checkout to prove the fix. The helper is not a new API or authority to publish.

## Release steps (owner-gated)
1. Confirm PR checks and repository provenance. Confirm the deployed function bundle is still v10 with its exact known SHA, and the public object is still the exact expected old digest.
2. Review/deploy the controller upgrade through the existing authorized Supabase Edge Function tooling, preserving its `verify_jwt` setting and source dependencies without reading, copying or forwarding service secrets.
3. Validate controller health and its unchanged owner/admin/internal gate with safe, nonmutating requests; do **not** submit a `deploy_static` request just to test.
4. Through the **existing** authenticated owner/admin/internal controller, invoke `deploy_static` for `sauceapproved-studio-offer` with the exact committed approved HTML, `approved_sha256` and `previous_sha256`; this step is explicitly controlled by the existing release gate.
5. Inspect the controller's result. Regardless of outcome, independently verify public Storage and Render exact byte digest, HTML response, current product checkout state, and rollback if needed.
6. Verify genuine Studio founding-access customer delivery only through an eligible, owner-approved flow.

No monthly subscription, new provider signup, payment or Shopify production mutation is involved in this guard.

## Provenance
Original SauceApproved/Hercules, AI-assisted helper/tests; baseline from the owner's already-deployed and authorized Supabase Edge Function v10. No third-party code was added. Node built-ins and Web standard APIs only. Supabase SDK dependency was **unchanged from the existing live deployment**. Tracking: [Studio release #1065](https://github.com/Sauceapproved7/expert-doodle/issues/1065).