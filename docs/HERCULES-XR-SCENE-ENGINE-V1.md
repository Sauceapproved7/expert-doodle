# Hercules XR Scene Engine v1

This layer consumes the Hercules Spatial Registry and produces deterministic, renderer-neutral scene frames plus bounded client sessions.

## Security boundary

- `xr:session` is required to open a client session or dispatch an interaction.
- Client capability declarations describe device support; they never add authorization scopes.
- Interactions are inert data unless a server-side handler is explicitly allowlisted.
- No payment, checkout, camera, geolocation, biometric, or publishing action is enabled by this module.
- Scene composition inherits owner isolation from the Spatial Registry.

## Differentiators

1. **Authority/Capability Split** — device features such as anchors or hit-test are negotiated separately from actor authorization, preventing a capable client from becoming a privileged client.
2. **Intent Firewall** — spatial interactions remain typed intents until an explicitly registered Hercules handler accepts them. This lets Studio, Kids Studio, training, and Commerce share one scene model without silently inheriting one another's powers.

These are Hercules differentiators, not exclusivity claims.

## Adapter model

The core has no WebXR, ARKit, ARCore, Unity, headset, or vendor SDK dependency. Future adapters translate the renderer-neutral frame into external device APIs while those SDKs remain third-party infrastructure under their own terms.

## Provenance

Original SauceApproved/Hercules implementation created with AI assistance. No third-party XR source, assets, SDK code, binaries, or model files are packaged.
