# SauceApproved Enterprise Software & IP Register

**Status:** Active enterprise governance register  
**Effective date:** 2026-09-27  
**Enterprise:** SauceApproved enterprise LLC (Connecticut)  
**Canonical Hercules repository:** `Sauceapproved7/expert-doodle`

## Purpose

This register is the intake and status record for software intended to sit under SauceApproved enterprise LLC. It prevents two opposite errors:

1. leaving company software undocumented; and
2. claiming the LLC owns software before the chain of title actually supports that claim.

The machine-readable rule is `governance/sauceapproved-enterprise-software-ownership-v1.json`.

## Current canonical portfolio

| Asset | Canonical evidence | Current status | Enterprise target |
| --- | --- | --- | --- |
| Hercules | This repository as a whole, subject to component-specific provenance and third-party rights | Current repository governance still declares `Sauceapproved7` as rights holder | SauceApproved enterprise LLC after executed assignment |
| Hercules Browser | Browser implementation, migrations, policies, recovery/operator documentation, and related repository tests | Included in the current Hercules chain of title; enterprise transfer pending | SauceApproved enterprise LLC |
| Hercules Ad Studio | `hercules-forge/ad-studio/`, `tests/hercules-ad-studio*.test.mjs`, `docs/HERCULES-AD-STUDIO.md` | Included in the current Hercules chain of title; enterprise transfer pending | SauceApproved enterprise LLC |

This table is deliberately limited to assets that have canonical repository evidence. External apps, services, domains, models, or software should be added only after their source/provenance and ownership path are verified.

## Default rule for new software

Going forward, software intended for the enterprise should be routed through this ownership intake before it is represented as a company-owned asset.

For each material asset record:

- canonical name and source location;
- creation/acquisition date;
- author or authorized source;
- material AI assistance;
- third-party dependencies and applicable licenses;
- commit, release, deployment, or artifact identifier;
- the document or legal basis that places the applicable rights in SauceApproved enterprise LLC.

Creation for the business is evidence of intent, but it is not used here as a substitute for legally sufficient chain-of-title documentation.

## Third-party boundary

The enterprise does not claim ownership of third-party libraries, runtimes, models, datasets, services, binaries, infrastructure, fonts, media, or other materials merely because Hercules integrates with or depends on them. Their licenses and ownership remain separate.

Prior valid open-source or other license grants are not revoked by a later assignment of the underlying copyright owner's remaining rights.

## Existing Hercules transfer

The repository currently identifies `Sauceapproved7` as the declared project rights holder. The target is to place the applicable assignable Hercules rights under SauceApproved enterprise LLC.

That transfer should be recorded with an executed written assignment. A prepared draft is at:

`docs/legal/SAUCEAPPROVED-ENTERPRISE-IP-ASSIGNMENT-DRAFT.md`

Until that instrument is executed, repository ownership assertions that identify `Sauceapproved7` remain historically and operationally accurate and should not be silently rewritten.

## After execution

After the assignment is signed, make a dedicated chain-of-title commit that:

1. updates `IP_PROVENANCE.md`;
2. updates `governance/owner-code-policy.json`;
3. updates intentional ownership constants/tests;
4. updates copyright/licensing notices only where legally appropriate;
5. records a non-sensitive reference to the executed assignment;
6. preserves all third-party rights and prior valid license grants.

Do not publish signatures, home addresses, private identifiers, or other sensitive execution material in this public repository.
