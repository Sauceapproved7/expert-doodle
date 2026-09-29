# SoundWorld V1 — Engineering BOM / Selection Envelope

This is a design envelope, not a purchasing BOM. Exact part numbers are selected only after simulation and bench evidence.

| Subsystem | V1 requirement | Selection gate |
|---|---|---|
| Mid-bass drivers | 2 matched long-excursion drivers | low distortion, excursion margin, thermal power, sealed/passive-radiator suitability |
| Tweeters | 2 matched high-frequency drivers | dispersion, sensitivity match, distortion |
| Passive radiators | opposed pair | tuning range and excursion margin |
| Amplifiers | independent high-efficiency Class-D channels | output into chosen impedance, noise, protection, thermals |
| DSP | multi-channel audio DSP | EQ, crossover, limiter, dynamics, Scene Mode headroom |
| MCU | low-power secure controller | signed update verification, A/B rollback, group control |
| Wireless radio | qualified Bluetooth-capable module/design | audio profiles, range, coexistence, qualification evidence |
| Battery pack | protected rechargeable Li-ion pack | runtime/thermal targets, cell traceability, safety docs |
| BMS/fuel gauge | hardware protection + telemetry | OV/UV/OC/OT fault response |
| USB-C power | charging controller + protected port | thermal, charge time, connector cycle life |
| Enclosure | impact-resistant sealed shell | acoustic stiffness, gasket sealing, drop/abrasion |
| Grille | rigid corrosion-resistant protection | acoustic transparency, dent/abrasion |
| Sensors | battery + amplifier/enclosure temperature | calibrated protection behavior |

## Architecture freeze criteria
No production BOM until driver/enclosure acoustic simulation, amplifier thermal budget, battery energy budget, radio path, service strategy and certification plan are reviewed together.

## Prototype stages
EVT-A: acoustic mule. EVT-B: electrical/thermal mule. EVT-C: integrated rugged prototype. DVT: production-equivalent materials, tooling intent and firmware.
