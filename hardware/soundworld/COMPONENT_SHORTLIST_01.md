# SoundWorld V1 — Real Component Candidate Shortlist 01

Status: desk qualification only. No MPN is frozen and no purchasing is authorized.

## Amplifier — primary candidate family
TI TAS5825M. Official data: 4.5–26.4 V power stage, stereo digital input, integrated DSP/speaker thermal and excursion protection, over-current and thermal protections. This is materially better aligned to the current 14.4 V nominal battery bus than TPA3255, whose published minimum power-stage supply is 18 V. Candidate topology for four outputs: two stereo devices, subject to measured efficiency/thermal/noise validation.

TPA3255: reject from current primary portable architecture because its 18 V minimum requires a higher amplifier rail than the frozen 14.4 V nominal battery interface. Revisit only if architecture intentionally adds a boost rail.

## Audio DSP — candidate
Analog Devices ADAU1467. Production-listed, programmable SigmaDSP, up to 294.912 MHz, 48-channel digital I/O and substantial audio processing capacity. Desk candidate for crossover/EQ/limiter/Scene Mode orchestration. Must validate power budget, boot architecture, licensing/tool workflow and production firmware path.

## Wireless/control — candidate
Nordic nRF5340. Dual-core Bluetooth SoC; Nordic positions it for LE Audio and provides an Audio DK. Candidate for wireless/control and Hercules Link research. Bluetooth Classic compatibility requirements, phone interoperability, group synchronization architecture and qualification path remain explicit gates.

## USB-C charger/power path — candidate
TI BQ25792. 1–4 cell buck-boost charger, up to 5 A, 3.6–24 V input, NVDC power-path management and USB PD 3.0 OTG support. Strong desk fit for a multi-cell pack and 45 W-class USB-C architecture; exact PD controller/system integration and thermal budget still require design review.

## Battery manager / fuel gauge — candidate
TI BQ40Z50 family. Supports 1–4 series Li-ion/Li-polymer packs, cell balancing, voltage/current/temperature protections, SMBus telemetry and fuel gauging. Candidate only; pack topology, cell chemistry and production authentication strategy remain unfrozen.

## Hard holds
Mid-bass driver, tweeter, passive radiator and battery cells remain unselected. These require complete manufacturer mechanical/acoustic/cycle evidence and physical sample measurements; generic marketplace specifications are insufficient.

## Current disposition
TAS5825M: SHORTLIST
ADAU1467: SHORTLIST
nRF5340: SHORTLIST / interoperability study required
BQ25792: SHORTLIST
BQ40Z50 family: SHORTLIST
TPA3255: HOLD / incompatible with current nominal rail without boost architecture

No candidate is productionReady or claimReady.
