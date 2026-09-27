# Hercules Production Operations Readiness v0.1

This gate separates production operating evidence from staging evidence.

Hercules already has sampled staging SLO tooling. Sampled staging evidence remains useful, but it is not treated as proof of continuous production reliability.

Production operations readiness requires:
- active release evidence
- health/readiness evidence
- structured logs
- alerting
- backup/restore evidence
- deployment rollback evidence
- production SLO history
- continuous telemetry enabled

Every required evidence item must be VERIFIED and bound by SHA-256 evidence.

## Safety boundary

The gate does not deploy software, configure an alert provider, create backups, or fabricate production history. It prevents Hercules from calling the production operating layer ready until those real controls produce evidence.

Staging success alone cannot satisfy this gate.
