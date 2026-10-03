# SoundWorld 1–12 — Product & Engineering Program

Owner: SauceApproved enterprise LLC  
Status: product architecture defined; physical production claims remain fail-closed.

## Family
1. Computer Pro — USB-C/Bluetooth/3.5mm over-ear computer headset; detachable/hidden mic; passive wired fallback; multipoint; low-latency and call modes; serviceable pads.
2. Pods — true-wireless earbuds with multipoint, transparency, call microphones and USB-C case.
3. Max — premium wireless over-ear headphones with USB-C/Bluetooth/3.5mm and passive wired fallback.
4. Portable — portable Bluetooth/USB-C speaker, stereo-pair-ready.
5. Desk — compact powered near-field computer speaker pair.
6. Mic — USB-C desktop creator/call microphone with direct headphone monitoring.
7. Creator Headset — closed-back wired/USB-C editing and zero-latency monitoring headphones.
8. Mini — clip-ready compact portable speaker.
9. Bar — desktop monitor/TV soundbar with dialog and desk modes.
10. Hub — USB-C desktop audio dock for routing, volume, mute and device switching.
11. Control — Hercules companion software for EQ, microphone controls, routing, presets, diagnostics and signed firmware status.
12. Studio Bridge — governed handoff between SoundWorld hardware and SauceApproved Studio.

## Shared Hercules rules
- No physical product is called production-ready before acoustic, electrical, thermal/battery, RF/EMC planning, prototype, DFM and QC gates are satisfied as applicable.
- Wired fallback is preferred for listening products where the architecture supports it.
- Replaceable wear parts are preferred where practical.
- Firmware changes require an explicit signed/update workflow; Control never silently mutates firmware.
- Studio Bridge carries device/profile provenance through Proof Spine.
- Performance or device telemetry cannot silently mutate Brand Brain.
- Credentials, private keys, passwords and 2FA are never collected through SoundWorld surfaces.

## Computer Pro design target
The first hardware engineering package centers on comfort and reliability before cosmetic gimmicks:
- circumaural over-ear shell;
- adjustable reinforced headband;
- replaceable ear cushions;
- USB-C digital audio;
- Bluetooth multipoint;
- 3.5mm passive wired audio;
- detachable or retractable/hidden microphone architecture;
- hardware mute and volume;
- low-latency computer mode;
- call mode;
- physical connection/status indicators that remain understandable without the app.

Validation must include frequency response, microphone call quality, latency, battery runtime, long-session comfort, hinge cycling and cable cycling.

## Manufacturing package required before sourcing
For each physical SKU: industrial-design drawings, mechanical envelope, acoustic target, electrical block diagram, preliminary BOM, battery/power budget where applicable, firmware requirements, materials/finish callouts, DFM review, prototype test plan, compliance plan, QC limits, packaging/drop plan, service/repair plan and golden-sample acceptance criteria.

## Ecosystem differentiators
**Proof Spine Audio** — a Studio project can retain the identity of the SoundWorld input/profile and the provenance of its audio handoff.

**Studio Bridge** — device routing and approved audio profiles can travel with a Studio project without silently changing the user's Brand Brain or publishing anything.

## Commercial boundary
This repository defines owned product requirements and software contracts. It does not assert that physical units have been acoustically validated, certified, manufactured, FCC-authorized, safety-certified, or approved for sale. Those claims require current evidence from actual prototypes and applicable compliance work.
