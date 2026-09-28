# Hercules SmokeScreen Sentinel v2.2.0 — Release Notes

## ATT&CK/TTP enrichment

v2.2 adds a privacy-bounded MITRE ATT&CK candidate mapping layer to Forge SmokeScreen observations.

### Mappings

- **T1110.004 Credential Stuffing** — high confidence when the existing normalized `credentialStuffing` signal is true.
- **T1110.001 Password Guessing** — medium-confidence candidate from repeated authentication failures when credential stuffing is not already identified.
- **T1595.003 Wordlist Scanning** — medium/high-confidence candidate from repeated route probing and enumeration patterns.
- **T1087 Account Discovery** — medium-confidence candidate only when enumeration behavior occurs on an identity-category route.
- **T1190 Exploit Public-Facing Application** — low-confidence candidate only when repeated signature mismatch evidence and a privilege-boundary probe corroborate each other.

### Anti-overmapping

v2.2 does not infer Network Service Discovery from web-route probing and does not infer Valid Accounts from credential attempts without successful use evidence.

### Safety

Enrichment cannot change routing, rate limits, Mirage state, accounts, infrastructure, or provider configuration. It produces evidence metadata only.

### Benchmark status

The last verified global-readiness score remains **64/100** until the global benchmark is rerun after this release. The synthetic fixture remains separately labeled and is not a production performance claim.

## Provenance

Original SauceApproved/Hercules source. MITRE ATT&CK public technique documentation informed the mapping taxonomy; no MITRE source code or competitor source code is packaged.
