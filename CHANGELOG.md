# Hercules Changelog

Canonical implementation remains the Git commit history and release tags.

## Unreleased

### Security and assurance

- Harden Forge password storage with explicit scrypt parameters.
- Preserve compatibility with legacy scrypt hashes and upgrade them after successful login.
- Add repository security policy and formal threat model.
- Add local security-baseline enforcement and CodeQL analysis.
- Add release manifest, SPDX SBOM generation, and signed GitHub artifact attestations.
- Convert global infrastructure maturity scoring from hardcoded values to named evidence-derived controls.
- Add CODEOWNERS, contribution rules, machine-readable Forge API contract, and release hygiene.

### HURC

- Keep signer custody testnet-only and Vault-backed.
- Preserve Base Sepolia-only signing boundary.
- Require differential/fuzz/independent review before real-value use.
