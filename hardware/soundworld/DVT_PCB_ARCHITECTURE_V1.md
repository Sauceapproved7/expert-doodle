# SoundWorld V1 — DVT PCB / Electrical Architecture

Status: interface architecture. Exact IC part numbers and PCB geometry remain unfrozen pending measured EVT requirements and component qualification.

## Board partition
1. USB-C PD + input protection.
2. Battery/BMS + fuel gauge + pack disconnect.
3. Regulated low-voltage digital rails.
4. Bluetooth/radio subsystem with antenna keep-out.
5. Control MCU with secure boot/update support.
6. Dedicated audio DSP.
7. Four independent Class-D output channels: L/R mid-bass and L/R HF.
8. Sensor/telemetry plane.
9. Service/debug boundary disabled or physically controlled in production.

## Power tree
USB-C -> PD/input protection -> system power path -> battery charger/BMS -> battery bus.
Battery/system bus -> amplifier power domain.
Battery/system bus -> regulated digital rails -> MCU/DSP/radio/sensors.
Power-path design must support safe playback while charging without exceeding connector, charger, cell or enclosure thermal limits.

## Audio path
Bluetooth/local source -> DSP -> four amplifier channels -> two mid-bass + two tweeters.
DSP owns crossover/EQ and requests output. Hardware protection and firmware safety remain higher authority than Scene Mode or Hercules Link.

## Telemetry
Minimum retained engineering telemetry: battery voltage/current/temp, charger state, amplifier temperature/fault, limiter activity, brownout/reset cause, firmware identity, Scene Mode, Hercules Link role/sync state.

## PCB constraints before layout
- Separate noisy switching/high-current paths from low-level audio/radio.
- Controlled return-current strategy.
- RF antenna keep-out and enclosure interaction must be reviewed before placement freeze.
- High-current copper/connector sizing comes from measured current and thermal rise.
- USB-C ESD/protection and connector mechanical reinforcement required.
- Temperature sensors must represent the protected component, not merely convenient PCB locations.
- Production debug access must not create an unauthenticated control path.

## Component-selection gates
No amplifier/DSP/MCU/radio/charger/BMS part is frozen until voltage/current/thermal headroom, lifecycle/availability, firmware support, compliance path and sourcing risk are reviewed. Candidate substitution requires interface compatibility plus regression validation.

## DVT evidence
Schematic review, power-tree worst-case analysis, fault injection, conducted/radiated pre-scan, thermal map, amplifier noise/distortion, radio coexistence/range, PD interoperability, brownout recovery, firmware rollback, protection override attempts, Scene Mode invariant checks and Hercules Link sync tests.

productionReady: false
claimReady: false
