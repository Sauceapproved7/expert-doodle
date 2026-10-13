# Hercules-owned Founding Circle confirmation core v1

**Owner:** SauceApproved. **State:** built and safety-tested; not integrated with live signup and not authorized to send emails.

This is original first-party Node.js code that prepares one-time email confirmation **without a MailerLite/Resend dependency**. It is a library, not a live sender or a hosted membership service.

## Behavior

1. An existing, explicit-consent founding record must first be resolved by a **private owner-controlled durable repository**; the public email input alone is insufficient.
2. All independent deployment gates must pass: verified sender authority, independently observed email receipt, durable storage/restart-proof, externally verified HTTPS, owner-specific release approval, and a tested live confirmation page. **Runtime truth must come from a trustworthy operator/verification process—not client-provided flags.**
3. A cryptographically random 256-bit token is generated. Only its SHA-256 digest is persisted. The token is placed after the `#` in the confirmation URL and delivered exclusively to a trusted server-side sender callback.
4. Durable storage must atomically reserve the challenge and enforce deduplication/rate caps; a failure to reserve refuses sending. If a send is rejected, the pending challenge is revoked. SMTP's acceptance is explicitly reported as **unverified**, not as confirmed receipt.
5. To verify, the user must possess the token, and an atomically consumed, not-expired, not-previously-used challenge must be committed by the durable backend. No hosting entitlement, user account, beta acceptance or payment follows from email verification.

## Adapter contract

`repository.eligible(email)` returns a record containing an email, `status:'unverified'`, `consentAt` timestamp only if there is genuine recorded consent.

`repository.reserve({email,tokenDigest,issuedAt,expiresAt})` returns true only after an atomic durable store reservation respecting global caps and per-address cooldowns. It must refuse duplicates and preserve records across process restarts.

`repository.markSent({email,tokenDigest,at})` verifies exact challenge digest and commits a sent-but-not-confirmed marker.

`repository.revoke({email,tokenDigest})` invalidates the specified challenge if delivery fails.

`repository.consume({tokenDigest,now})` atomically verifies a pending sent challenge, checks expiry, marks the confirmation as used, marks ONLY the email ownership as verified (with consent still tracked), and returns `{email,confirmed:true}`. Duplicate or expired tokens must return null. It must never create or alter customer authorization, paid purchases, or hosting entitlements.

`sender.send({to,link,subject,text})` sends a single confirmation only through owner-approved infrastructure. The sender and private repository remain unavailable in the **current Render static site**. Do not expose tokens to browser JavaScript, logs, or GitHub test artifacts.

## Safety / current realities

- Current public founding-interest and early-tester forms remain **unverified** and available on the existing free static Render site backed by Supabase.
- Current business sender continuity ledger remains `waiting_provider_authorization` (DNS and provider verification false). No MX/SPF/DMARC records or delivered test receipt have been independently established.
- This new code does **not** automatically approve a third-party mailing connection, DNS changes, custom MX record, provider verification, hosted SMTP server, payments or new hosting costs.
- No encrypted owner mail-server credential or actual mail host was found that can be used under existing free-hosting restrictions; use of a new service needs separate verification.
- The existing `hercules_owned_circle_v02.zip` local standalone Node/SQLite app contains a separate owner-authored SMTPS transport, but must not be made public on ephemeral Render Free storage. This source-only engine is designed for a future verified durable adapter, not a shortcut around that limitation.

## Proof

`node --test tests/hercules-circle-native-confirmation.test.mjs`

Tests use a fake store and fake sender; they **do not** send live messages, write database rows, or invoke private credentials. After CodeQL, policy and CI pass, merge only to the isolated Hercules Circle feature branch. A future public rollout requires an independently verified real SMTP/HTTPS sender, usable confirmation page and owner-controlled durable challenge database, followed by a genuine opt-in mailbox test.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
