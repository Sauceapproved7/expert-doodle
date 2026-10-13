# Hercules Mobile Codex Control

This directory contains a mobile-first control interface for iPhone, Android, and desktop.

## Current capabilities
- Prepare and copy task instructions (maximum 4,000 characters).
- Link to the existing Hercules MCP and Smallz services.
- Display a truthful disconnected state.

## Explicitly not connected
- No authenticated Codex executor is registered.
- No backend task submission or polling endpoint is wired.
- No computer or iPhone system-level access.
- No production deployment authorization.

## Integration requirements
1. Register a Codex environment with an authorized execution identity.
2. Implement an authenticated backend task API with owner-scoped access and CSRF protection where cookie sessions are used. Never put bearer tokens in browser source.
3. Store durable task identifiers and poll task status from the backend, not directly from a browser-held secret.
4. Run end-to-end tests against an isolated environment, then require explicit owner approval before production changes.

The submit control intentionally remains disabled until these conditions are proven.
