# Hercules Command Surface v0.1

The command surface gives Hercules one provider-neutral command contract for owned capabilities.

## Initial capability map
- forge.build -> hercules-forge
- base.blueprint -> hercules-base
- chat.run -> hercules-chat
- recovery.assess -> hercules-recovery
- recovery.route -> hercules-recovery
- video.render -> hercules-video
- deploy.release -> hercules-deploy

Commands bind an intent identifier, a supported capability, payload, and deterministic SHA-256 integrity digest.

## Safety boundary
The command surface only normalizes and routes. It does not execute a provider action, choose credentials, mint authority, or bypass the unified execution lifecycle.

Provider names are deliberately excluded from the public capability vocabulary. Provider-specific adapters remain behind owned Hercules modules.

`executionAuthority` is always false.
