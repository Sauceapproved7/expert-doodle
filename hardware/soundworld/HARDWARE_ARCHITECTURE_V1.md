# Hercules SoundWorld Portable Speaker — V1 Hardware Architecture

Status: engineering specification; not production-certified.
Owner-code scope: SauceApproved/Hercules design source. Manufacturing is downstream execution of this specification.

## Product intent
A premium portable speaker engineered around clean sustained output, controlled bass, rugged portability, serviceability, and SoundWorld software behavior. No performance, ingress, battery-life, drop, or abrasion claim becomes customer-facing until validated on production-equivalent hardware.

## V1 system architecture
- Acoustic: 2-way stereo architecture; dual long-excursion mid-bass drivers, dual tweeters, opposed passive radiators. DSP crossover, excursion limiting, thermal limiting, dynamic bass management.
- Amplification: independent Class-D channels sized only after driver impedance/sensitivity and enclosure simulation are frozen.
- Compute/DSP: dedicated audio DSP plus low-power control MCU. Signed firmware images and rollback-safe update slots.
- Wireless: current-generation Bluetooth audio; multi-speaker synchronization is an owned application-layer requirement. Final radio/module selection must preserve qualification/certification path.
- Power: protected rechargeable lithium battery pack, USB-C charging, fuel gauge, cell temperature sensing, over-current/over-voltage/under-voltage protection. Power-bank output is optional until thermal/endurance validation.
- Mechanical: sealed impact-resistant enclosure, protected grille, replaceable high-wear external parts where practical, internal gasket strategy, drop-energy management, corrosion-resistant fasteners.
- Service: battery and port subassemblies should be replaceable without destroying the acoustic enclosure when practical.

## Hercules differentiators
### 1. SoundWorld Scene Mode
DSP scene profiles: Cinema, Music, Voice, Outdoor, Night. Each profile has explicit loudness, bass-excursion, dialogue-presence and thermal constraints. No mode may defeat driver protection.

### 2. Hercules Link
More than ordinary stereo pairing: a synchronized speaker group can assign roles (front, fill, dialogue-focus, bass-support) and maintain a shared scene profile. Group degradation must fail gracefully if a node disconnects.

## Safety / fail-closed rules
- Protection limiters cannot be disabled by consumer presets.
- Battery or thermal faults reduce output or shut down safely.
- Firmware update failure rolls back to last-known-good image.
- No microphone/cloud listening is required for core playback.
- No real-world certification mark is claimed until independently earned.

## Engineering gates
G0 architecture review -> G1 acoustic simulation -> G2 electrical/thermal design -> G3 EVT prototypes -> G4 measured acoustic + endurance testing -> G5 drop/abrasion/ingress pre-compliance -> G6 radio/electrical certification -> G7 DVT production-equivalent units -> G8 pilot production.

## Required validation evidence
Frequency response; max SPL by frequency; THD+N vs level; compression at sustained output; battery runtime at defined SPL; charge time; enclosure/amp/battery temperatures; drop survival; abrasion; ingress; Bluetooth range/reconnect; multi-speaker sync latency/drift; firmware rollback; battery protection fault tests.

## Claim policy
Targets are not claims. Marketing may only use measurements tied to a test method, hardware revision, firmware revision and retained evidence.
