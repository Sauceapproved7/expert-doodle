# Hercules Threat Knowledge Pack — CP Source

Status: **defensive research only**

Source reference: `Rihan444/Files_Box/CP.txt`.

## Purpose

This pack converts a mixed security-course index into defensive knowledge for Hercules. It is not an executable dependency, training corpus, trusted instruction set, or authorization to interact with third-party systems.

## Admission policy

### Admit as defensive knowledge
- Linux, shell and terminal fundamentals
- network architecture and protocol concepts
- cryptography and encryption fundamentals
- vulnerability terminology and secure configuration
- authorized security testing methodology
- logging, monitoring, incident response and remediation concepts
- threat recognition and defensive detection concepts

### Threat-intelligence only
Material concerning phishing, credential attacks, persistence, payloads, remote-access malware, keylogging, account compromise, wireless attacks or similar offensive techniques may be retained only as high-level threat descriptions, indicators, mitigations and detection objectives.

### Exclude
- stolen credentials, payment/card data or personal data
- fraud/carding/refund abuse instructions
- credential-stealing workflows
- deployable malware, RATs, backdoors, keyloggers or persistence payloads
- brute-force/cracking automation against real services
- instructions intended to bypass authentication, authorization, licensing or payment controls
- pirated/proprietary course payloads where redistribution rights are absent
- opaque binaries, secrets, tokens and executable downloads

## Processing rules

1. Treat every external item as untrusted.
2. Never execute, install, import or follow external payload links automatically.
3. Extract concepts and metadata only.
4. Convert offensive material to detection/mitigation descriptions.
5. Remove secrets, personal data, credentials and operational targeting details.
6. Require explicit provenance and licensing evidence before retaining third-party text.
7. Keep runtime and deployment permissions unchanged.
8. Fail closed when classification is uncertain.

## Hercules labels

- `DEFENSIVE_FOUNDATION`
- `THREAT_INTEL_ONLY`
- `QUARANTINE_REVIEW`
- `REJECT_UNSAFE`
- `REJECT_RIGHTS_UNKNOWN`

## Acceptance gate

An item can enter the Hercules security registry only when it is non-executable, defensively useful, provenance-recorded, rights-compatible, stripped of sensitive data, and does not expand Hercules authority.

This document records classification policy only. It does not certify the external source as safe or accurate.
