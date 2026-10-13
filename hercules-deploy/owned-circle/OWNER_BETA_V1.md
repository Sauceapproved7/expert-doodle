# Hercules Circle Owner Vault + Early Tester Interest (Stage 0)

**Purpose:** privately inspect unverified founding-interest records using an *existing* Hercules owner account, and record early-tester **interest**, not registrations or guarantees.

## What was added
- `/owner.html` — owner-only read-only browser dashboard. Uses existing Supabase Auth email/password sign-in without creating accounts. No password, token, email or subscriber list is stored in localStorage, sessionStorage or cookies by the application. Records are requested with the temporary access token and rendered using DOM `textContent` (no HTML injection).
- Owner authorization is enforced by **Postgres RLS**, not a front-end flag. A new allowlist table is seeded exclusively from the unique already-existing `auth.users` account with active `public.hercules_memberships.role='owner'`. Any other user or anonymous visitor sees **no private records**. Supabase Auth sign-in ability for the existing owner has not been end-to-end tested on this site.
- `/early.html` — free, consent-based **early-tester interest request**, collecting email and enumerated project type/stage, without free-text secret fields. Does not reserve a beta place, confirm email ownership, create a paid/hosting account, grant membership, or send emails.
- A separate Supabase RLS table `public.hercules_circle_early_requests`. Anonymous users can invoke only a narrow SECURITY INVOKER public RPC or insert constrained columns; no public read/list, update, or delete privileges. A private not-directly-callable SECURITY DEFINER trigger validates/deduplicates, stamps unverified status and consent time, and caps new entries at 40/24h.
- The original free founding-interest RPC and ecommerce systems are unchanged. **No real email sending, beta enrollment, payouts, checkout, subscriptions, or Hercules public account signup** are enabled.

## Verification gates
1. Exact-head GitHub tests/CodeQL/provenance/owner-code safety must pass before applying migration.
2. Apply the **additive** migration `20261013180000_hercules_circle_owner_beta_interest_v1.sql` to existing Supabase project. Abort if it cannot identify exactly one existing active owner account.
3. Verify SQL under anonymous, authenticated non-owner and current active owner roles, all inside rolled-back test transactions. Confirm no anonymous table SELECT privileges, early-tester consent rejected/accepted, duplicate generic response, and zero synthetic entries persisted. Run Supabase Security Advisor.
4. Merge into isolated `feature/hercules-owned-circle-app-20261013` branch only, then manually deploy **existing** free Render static service `srv-db77dfdg1s2s739c5n10`, auto-deploy off. Do not merge into production main or touch other websites.
5. Public GET/form and owner browser login **must be independently proven** before claiming full web-to-database validation. Do not put passwords, bearer tokens or private subscriber data into chat or logs.

## Operational truth
The provider confirmed the previous free-interest site live with zero stored interests; this release adds early-tester research and an authorized owner dashboard. It cannot send messages without a verified deliverability path. Existing Render static + Supabase may be metered but no new subscription is authorized.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
