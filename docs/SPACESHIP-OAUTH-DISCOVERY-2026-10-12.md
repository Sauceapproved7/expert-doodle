# Spaceship OAuth discovery compatibility

Live owned-browser request 100807 failed before provider login with spaceship_oauth_metadata_endpoint_mismatch. Official issuer metadata retrieved October 12 advertises registration_endpoint=https://id.service.spaceship.com/connect/register, while Hercules pinned https://mcp.spaceship.com/register. Issuer, authorization, and token endpoints match existing pins.

Update the exact registration pin rather than accepting arbitrary discovery URLs. Existing stored public client registration is reused; new registration, if needed, uses the advertised pinned endpoint. Provider rejection remains a failure. No stored client credential or registrar grant is fabricated or re-enabled.

Six executable discovery tests cover the observed metadata and rejection of modified issuer, authorization, token, registration, and protected-resource issuer. The positive test reproduced the pre-change failure. Existing OAuth/PKCE/Vault and handoff tests must also pass.

This repair only removes the discovery mismatch. Provider login, consent, possible human verification, token exchange, and successful DNS reconciliation still require independent live evidence.

Differentiators: exact-endpoint trust validation with executable provider-compatibility evidence, and Vault-isolated owned-browser handoff with no credential output. These are Hercules design properties, not exclusivity claims.

Sources: https://id.service.spaceship.com/.well-known/oauth-authorization-server and https://mcp.spaceship.com/.well-known/oauth-protected-resource .
