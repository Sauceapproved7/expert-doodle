# Hercules-Owned Founding Circle — independently built app

**Current stage: locally built and tested; live subscriber acceptance DISABLED.**

This is the first-party replacement for an email-marketing SaaS integration. The complete standalone source package was produced independently as `hercules_owned_circle_v02.zip` (SHA-256 `b05062d41e6c116af12e786f5d022f7dcce3a47ef550ee4e5786b0c949c5d4a3`) and is included as an artifact of the October 13, 2026 conversation, not yet installed on a verified private server. The binary package is **not** committed here because Hercules owner policy prohibits committed archives.

The standalone Node 22 application uses built-in modules only, including SQLite and TLS, and supports private member data, opt-in with single-use email confirmation, verified-only beta applications, member withdrawal and owner-only read access. Release preflight requires valid HTTPS, independently proven durable data storage, a verified working SMTPS sender, and explicit owner release approval.

**Test evidence:** 12 of 12 local unit and HTTP integration tests passed, including a new release-readiness suite. No email was actually sent and no live customer was registered.

## Hosting safety

The application **must not** accept subscribers while its data is on an ephemeral server filesystem. Render Free web services lose local SQLite state upon spin-down or redeploy; a new free Render web service does not meet durable subscriber storage requirements. See https://render.com/docs/free. No paid instance, persistent disk, SMTP provider or new subscription was commissioned.

The existing `hercules-cloud-origin-preview.onrender.com` static site and its protected Supabase **unverified-interest** form remain a distinct current operation. **Do not** replace those services or the user's live storefront with this backend until a genuine persistent host and sender have been independently verified.

## Next integration gate

1. Verify an existing owner-approved host with a persistent, owner-controlled SQLite volume and backup/restore tested.
2. Verify an approved sender/SMTPS server and an actual confirmation email using a real opted-in mailbox.
3. Confirm live HTTPS, SPF/DKIM/DMARC policy, secret storage, privacy/retention and subscriber deletion mechanisms.
4. Run the app's 12-test suite and a reversible live synthetic signup, then owner-approve a narrowly scoped cutover.
5. Keep any initial full-app deployment off public traffic until these conditions are satisfied.

No Shopify, Stripe, payment, DNS, hosting budget, Hercules public-auth or existing production service authorization is implied by this record.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
