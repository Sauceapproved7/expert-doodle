# Hercules Video Live Bridge v1

## Scope

SauceApproved Studio now has a live, owned Hercules Video control-plane bridge through `hercules-preview-cell`.

Live routes:

- `GET /video/health`
- `GET /video/capabilities`
- `POST /video/render`
- `GET /video/jobs/:id`

The Studio preview injects a runtime status indicator that reads the health route.

## Security

- Public health/capability reads expose only sanitized capacity information.
- Render and job mutations require an authenticated SauceApproved owner/admin.
- The bridge uses the canonical `sauceapproved.hercules.video-render-request` contract.
- Render requests are fingerprinted deterministically.
- No output is fabricated.
- If no certified video renderer is online, requests fail closed and are not queued.
- A blocked render is recorded in the Hercules audit log.

## Current verified production-preview state

At verification time on 2026-09-28:

- Hercules Video orchestration bridge: connected.
- Certified video workers online: 0.
- Certified video adapters ready: 0.
- Render capacity: unavailable.
- Blocking reason: `no_certified_video_renderer_online`.
- Unauthenticated render request: rejected with HTTP 401.
- Existing accepted SauceApproved Studio preview remains live.

## Deliberate boundary

Supabase Edge is the orchestration/control plane. It is not being treated as a GPU video renderer. The generic Hercules Edge Worker allowlist remains unchanged and does not accept `video.render`.

A renderer may be connected later only through a certified Hercules Video adapter/worker contract. Until then, Studio remains truthful and fail-closed.
