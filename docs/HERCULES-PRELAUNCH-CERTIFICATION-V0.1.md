# Hercules Pre-Launch Certification v0.1

This certification exercises the first-customer path with synthetic data before a real customer is exposed to Hercules.

## Journey under test

Synthetic customer/workspace
-> customer role/plan/usage boundary
-> Revenue Recovery product case
-> Hercules command normalization/routing
-> Proof Object
-> Consequence Envelope
-> Proof/Consequence binding
-> Time Machine restore point
-> Unified Execution lifecycle
-> authorized-execution boundary

The certification deliberately stops before an external action. A passing synthetic journey proves internal composition and fail-closed behavior; it does not prove provider authorization, a live payment account, production uptime, or real customer outcomes.

## Launch-gate checks

The suite also proves:
- a complete well-formed hardening evidence set can satisfy the hardening evaluator;
- production operations remain NOT_READY when continuous telemetry and real production evidence are absent.

## Certification rule

Synthetic evidence must never be copied into production evidence records or used to claim real uptime, backup/restore success, provider delivery, payment activation, or customer success.

Production certification requires real evidence from the active production environment.
