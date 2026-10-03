# SoundWorld Pods + Max — Component Freeze 01

## Primary premium audio platform candidate
Qualcomm QCC7226 / Snapdragon S7 Gen 1 class is the primary EVT architecture candidate for both Pods and Max, subject to commercial access, exact package/reference-design availability, licensing, lifecycle and supplier qualification.

Why: integrated premium earbud/headphone architecture with programmable DSP, hybrid/adaptive ANC capability, Bluetooth/LE Audio and premium codec paths. Hercules software remains product-owned application behavior above licensed platform capabilities.

## Pods component envelopes
- Driver: single dynamic micro-driver study; exact diameter/diaphragm/impedance frozen only after coupler measurements and fit-volume study.
- Microphones: minimum external ANC reference + internal feedback path per bud, with voice pickup architecture; exact MEMS MPN requires noise, AOP, sensitivity matching and current qualification.
- Battery: protected single-cell Li-ion/Li-polymer pouch per bud; exact capacity follows ergonomic volume, thermal and measured runtime study.
- Case: protected rechargeable cell, USB-C input, independent left/right charge supervision and thermal telemetry.
- Sensors: wear detection plus temperature/fault telemetry.
No arbitrary driver, microphone or cell MPN is frozen without measured evidence.

## Max component envelopes
- Driver: large dynamic driver study; exact diameter/impedance/motor selected from measured FR/THD/compression in the owned earcup.
- Microphones: multi-mic hybrid ANC plus dedicated voice beamforming geometry.
- Battery: service-oriented protected single-cell or series architecture selected only after amplifier/audio-platform voltage and runtime model closes.
- Charging: USB-C protected charge path; wired-audio interface remains required and separately frozen.
- Sensors: battery/electronics temperature and wear-state study.

## Shared Hercules software boundary
Sound DNA, Continuity, Scene mapping, calibration records, signed update policy, rollback policy, diagnostic telemetry and hard hearing/loudness safety policy remain SauceApproved-owned behavior. Licensed silicon/codec/ANC IP is not represented as owned Hercules IP.

## EVT evidence before build-ready
Measured driver candidates; measured microphone candidates; qualified cells/packs; qualified charging path; acoustic fixture/coupler data; thermal model; antenna/RF review; firmware signing/rollback proof.

siliconFrozen: true
evtBuildReady: false
productionReady: false
superiorityClaimReady: false
