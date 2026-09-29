# SoundWorld V1 — Owned Battery Pack Architecture

SoundWorld owns the pack-level system design. Individual electrochemical cells and protection ICs are qualified components, not SauceApproved-manufactured chemistry.

## Electrical architecture
- 4-series rechargeable lithium-ion architecture
- 14.4 V nominal system target
- 80–100 Wh usable-design class; 90 Wh nominal design point
- BQ40Z50-family pack manager/gauge/protection architecture
- independent secondary over-voltage protection required
- cell balancing, pack current measurement and SMBus telemetry
- dual temperature sensing minimum: cell-group region + pack electronics region
- high-side disconnect/protection path
- keyed service disconnect and mechanically protected connector

## Mechanical architecture
- removable sealed battery cassette inside the speaker service zone
- no user access to bare cells
- strain-relieved harness
- isolation from amplifier heat source and passive-radiator travel
- impact retention independent of cosmetic enclosure
- vent/failure behavior must be assessed during safety engineering; enclosure must not intentionally trap an unsafe cell event

## Firmware authority
Battery protection cannot be disabled by Scene Mode, Hercules Link, EQ, customer settings or normal firmware commands. Unsafe voltage/current/temperature telemetry causes charge/playback derating or shutdown.

## Cell qualification gate
Exact cell manufacturer/model remains unfrozen. Freeze requires authentic traceable cells, chemistry profile, voltage/capacity/internal-resistance characterization, continuous and pulse current evidence, temperature limits, cycle-life evidence, dimensional tolerance and safety/transport documentation.

## Validation
Pack EVT requires instrumented charge/discharge, balancing, fault injection, thermal characterization, runtime/load transients, charger interaction and protection recovery. Transport and applicable product-safety compliance remain mandatory external evidence gates.

evtReady: false until exact cell + transport evidence
productionReady: false
claimReady: false
