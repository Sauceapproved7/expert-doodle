# Hercules Studio Infrastructure 1–12

This package closes the gap between a large software feature surface and a usable production environment.

1. Equipment Kit — data/charging/audio cables, powered USB hub, adapters, cable management and spares.
2. Power Station — surge protection, charging, UPS option, power budget and safe shutdown plan.
3. Camera I/O — USB camera, HDMI capture, external monitoring and capture-health proof.
4. Teleprompter — script import, speed, mirror, remote-control contract and Director integration.
5. Lighting Control — key/fill/back presets and governed hardware adapters with manual fallback.
6. Color Suite — waveform, vectorscope, white balance, exposure, LUTs, shot matching and comparison.
7. Monitor Mode — clean output, second screen, safe areas, aspect guides and client preview.
8. Camera + Mic Sync — waveform/manual sync, drift detection, alignment and multicamera readiness.
9. Hardware Control Surface — SoundWorld Hub contract for volume, mute, monitoring and record control through Studio Bridge.
10. Accessibility Suite — keyboard, screen-reader labels, high contrast, reduced motion and caption-first workflows.
11. Portable Project Package — project/media/timeline/captions/audio/Proof Spine/checksum bundle with restore validation.
12. Creation Floor Runtime — persistent storage, media ingest, timeline persistence, renderer, STT, DSP, review sharing, publishing, analytics and integration evidence.

## Evidence boundary
The manifest is an implementation contract, not proof that physical equipment exists or that external devices/providers are connected. Physical/hybrid layers remain unverified until real hardware evidence exists. Runtime capabilities remain blocked until current runtime evidence exists.

## Build order
Software work should proceed dependency-first: portable project schema and persistence foundations; media ingest; timeline persistence; renderer/STT/DSP adapters; sync/color/monitor/teleprompter/accessibility; private review; publishing and analytics; then verified hardware bridges.

Physical procurement should follow a measured bill of materials rather than assumed connector types. Exact cable lengths, power ratings, capture hardware, lighting protocols and adapters must be selected against the actual computer/camera/audio hardware.
