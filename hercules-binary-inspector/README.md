# Hercules Binary Inspector v1

Owned defensive binary-inspection surface for SauceApproved Hercules.

## Scope
- static metadata and cryptographic hashes
- file-format identification
- printable-string extraction
- evidence-first JSON reports
- optional IDA adapter boundary
- fail-closed authorization

This module does not execute submitted binaries, extract credentials, patch targets, or grant itself permissions.

The IDA integration is adapter-only: deployments may connect a properly licensed IDA installation. Third-party plugin code is not vendored here.
