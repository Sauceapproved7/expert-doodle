# Smallz secure setup rendering

A live October 12 read of the credential-drop page returned HTTP 200 but Content-Type text/plain and CSP default-src none; sandbox from the Supabase hosting gateway. The generated HTML alone did not prove a usable form.

Smallz now serves the existing handoff at /connect/spaceship?handoff_token=... with HTML content type and a restrictive policy allowing same-origin form submission. It uses no browser script. GET and POST relay to a fixed Hercules private-bridge URL; only the two bounded credential fields are forwarded. Existing provider validation, atomic handoff consumption, Vault storage, and launch continuation are reused.

Tests cover real HTTP form submission, malformed/duplicate tokens, foreign origins, unexpected fields, upstream failure, and credential echo exclusion. No real credentials are included in tests or repository files. Neither test authentication nor a rendered form proves successful provider authorization.

Differentiators: a script-free owned-host handoff without gateway HTML rewriting, and constrained credential relay with no upstream secret reflection. No exclusivity claim is made.
