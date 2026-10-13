# HERCULES CLOUD FOUNDING CIRCLE FIELD GUIDE
### Version 1.0 · October 2026 · Free founder toolkit

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**

Hercules Cloud is an original, owner-sovereign deployment platform in active development. This is a practical planning guide for entrepreneurs, builders, and operators who want to understand how to deploy software on infrastructure they control.

**Important:** This guide is not a hosting subscription, a deployed server, technical certification, or an entitlement to beta access. No production deployment is authorized by downloading or following this checklist. Existing live systems should remain unchanged unless separately reviewed.

## 1. Understand the four things you actually own

**Source code:** Where your application code lives. Verify repository ownership, collaborator access, license, and rollback commit history.

**Compute host:** A Linux machine or cloud server you can access and administer. The control-plane software may be yours, while the physical compute still belongs to a host. Check who pays for CPU, RAM, storage, backups, and network egress.

**Deployment authority:** The accounts, credentials, approvals and automation permissions allowed to build and operate services. Keep secrets out of source code and browsers.

**Customer data:** Application data, credentials, logs and backups. Define encryption, retention, incident recovery, and access before onboarding customers.

## 2. Seven-question host-readiness checklist

Check the following as a planning exercise. It is **self-reported**, not a compliance or production certification.

- [ ] **Host ownership:** You can identify the actual Linux host, root administrator and maintenance owner.
- [ ] **Cost verification:** The provider plan, current spend and possible metered overages are independently checked.
- [ ] **Rootless Docker:** Your sandbox runtime isolates containers and is verified to run without root privileges.
- [ ] **Pinned artifacts:** Every image/build is tied to an exact source commit and SHA-256 fingerprint.
- [ ] **Private credentials:** No shared service keys in client source, public logs, shell histories or chat messages.
- [ ] **Recovery proof:** You can start, verify, stop and roll back a disposable test application in a sandbox.
- [ ] **Public safety:** HTTPS, DNS, backups, monitoring, privacy policy, access rules and approval gates are in place before a customer release.

## 3. Hercules launch flow

1. **Design** the application and record the intended audience, dependencies and required resources.
2. **Prove ownership** of the source code, server and credentials.
3. **Check the price envelope.** Do not mistake a $0 software license for $0 running infrastructure.
4. **Build in isolation** on a new verified sandbox. Do not modify existing storefront or production services during evaluation.
5. **Pin the release.** Use exact commit, artifact digest and owner-authorized deployment plan.
6. **Run synthetic tests**: health endpoint, access restrictions, denied unsafe operations, and no-cost assumptions.
7. **Prove rollback**, including restoring the old release without affecting customer data.
8. **Approve separately** before attaching domains, live payment providers, public signup or production traffic.

## 4. Key questions before buying hosting

| Ask | Why it matters |
| --- | --- |
| What is billed per hour and month? | Idle compute, disks and egress can still cost money. |
| Can I set a hard spending cap? | Free credits and price estimates are not the same as a limit. |
| Can I export data and images? | Portability protects against provider lock-in. |
| What happens after trial credits expire? | Servers may stop or become billable. |
| Who rotates secrets and monitors incidents? | Infrastructure ownership creates ongoing duties. |

## 5. What's available from Hercules today?

- **Hercules Cloud Origin:** A public design and interactive, non-executing release preflight preview.
- **Founding Circle Toolkit:** This free guide and a local-only, self-assessed readiness checklist.
- **Founding Interest:** An opt-in email interest record, currently **unverified**. Signing up does not create an account or grant hosting access.

## 6. What is still being built?

- Verified production-grade Linux executor, managed deployment pipeline, customer hosting and rollback.
- Confirmed subscriber email delivery and double-opt-in, before founder update messages.
- An application-based beta program and any founding-member pricing or discounts.

**Early testing and founding pricing are under consideration, not guaranteed perks.** There is no promised invitation, reserved seat, release date, product license or discount. Never pay anyone claiming this free interest list is a paid hosting entitlement.

## 7. Your own deployment inventory

Fill this out privately and do not publish secrets:

- Application / repository:
- Source commit:
- Proposed host and legal operator:
- Hosting plan and independently verified cost cap:
- Deployment target (sandbox or production):
- Required runtime / memory / disk:
- Customer data and retention:
- Health-check and recovery plan:
- Responsible owner for launch approval:
- Rollback proof location:

**Keep credentials in a protected owner-controlled vault, not in this document.**

---

Hercules Cloud · Original SauceApproved platform · Free educational material, not a guarantee of service availability.
