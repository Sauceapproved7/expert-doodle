# Hercules Studio Infrastructure 1–12

This package closes the gap between a large software feature surface and a usable production environment.

## Ownership rule

All twelve Studio layers are SauceApproved/Hercules-owned implementations. No third-party hosted editor, rendering platform, teleprompter platform, color suite, review system, project runtime, accessibility layer, control surface software, or finished outside product may be substituted for a Hercules layer.

Universal interfaces and standards such as USB-C, HDMI, 3.5 mm audio, Bluetooth, file formats, operating-system device APIs, and electrical safety standards may be supported for interoperability. Supporting a standard does not transfer product ownership or runtime control to an outside platform.

Physical products remain SauceApproved designs. Commodity components and standards-compliant parts may be sourced when physical manufacturing requires them, but a finished third-party product is not relabeled as a Hercules build.

1. Equipment Kit — owned cable specifications, data/charging/audio cables, owned hub/adapter design, cable management and spares.
2. Power Station — owned power architecture, surge protection, charging, UPS option, power budget, safe shutdown and electrical-safety validation.
3. Camera I/O — owned capture interface, USB camera, HDMI capture, external monitoring and capture-health proof.
4. Teleprompter — owned script engine, import, speed, mirror, remote-control contract and Director integration.
5. Lighting Control — owned control layer, key/fill/back presets, scene profiles and protocol bridges.
6. Color Suite — owned color engine with waveform, vectorscope, white balance, exposure, LUTs, shot matching and comparison.
7. Monitor Mode — owned clean-output/second-screen engine with safe areas, aspect guides and client preview.
8. Camera + Mic Sync — owned waveform/manual sync, drift detection, alignment and multicamera readiness.
9. Hardware Control Surface — owned SoundWorld Hub contract for volume, mute, monitoring and recording through Studio Bridge.
10. Accessibility Suite — owned keyboard, screen-reader, high-contrast, reduced-motion and caption-first workflows.
11. Portable Project Package — owned project format carrying media references, timeline, captions, audio, Proof Spine and checksums with restore validation.
12. Creation Floor Runtime — owned persistence, media ingest, timeline runtime, renderer, STT, DSP, review, publishing, analytics and verification ledger.

## Evidence boundary

The manifest is an implementation contract, not proof that physical equipment exists. Physical and hybrid layers remain unverified until real hardware evidence exists. Runtime capabilities remain blocked until current runtime evidence exists.

## Build order

Proceed dependency-first: owned project format and persistence; media ingest; timeline persistence; renderer/STT/DSP; sync/color/monitor/teleprompter/accessibility; private review; publishing and analytics; then verified hardware bridges.

Physical engineering must use measured power, connector, thermal, signal-integrity and safety requirements. No electrical or manufacturing readiness claim is made before prototype and applicable safety validation.
