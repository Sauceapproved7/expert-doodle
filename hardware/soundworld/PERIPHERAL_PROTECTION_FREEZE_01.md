# SoundWorld V1 — Clock / Sensor / Connector / ESD Freeze 01

## Audio clock architecture
EVT audio family: 48 kHz primary sample rate with 12.288 MHz audio master-clock study path. nRF5340 supports I2S master/slave operation, low-jitter MCK generation and up to 96 kHz LRCK. Final clock-master ownership across nRF5340, ADAU1467 and amplifier domains is verified in schematic timing/ERC review.

## USB-C ESD
TPD4E05U06 selected as the EVT high-speed signal ESD candidate where its electrical/interface ratings match the final USB-C implementation. TI lists it ACTIVE, 0.5 pF typical IO capacitance and ±12 kV IEC 61000-4-2 contact protection. CC/VBUS protection remains matched to the TPS25751 reference implementation and cannot be inferred from the data-line protector alone.

## Sensors
Minimum: two battery temperature channels; amplifier/electronics thermal telemetry; pack voltage/current/SOC; charger fault/state; amplifier fault/limiter. Exact thermistor/temperature-sensor MPN and bias network remain schematic calculation items.

## Connectors
Battery connector must be keyed, current-rated, touch-safe in normal service and mechanically strain-relieved. Speaker outputs are keyed/polarity-controlled. EVT debug/programming connector is controlled and physically inaccessible in normal assembled operation. Exact connector families remain MPN freeze items after current, cycle-life and mechanical review.

## EMI/grounding
USB ESD parts sit physically close to the exposed connector with short return paths. RF keep-out and antenna reference layout are preserved. Charger/amplifier switching loops remain compact and separated from RF/audio clock/sense paths. Pre-compliance scan is required before DVT.

## Remaining before PCB release
Exact sensor and connector MPNs; CC/VBUS protection network; oscillator/load components per reference designs; complete schematic ERC; power/ground review; RF review; thermal review.

peripheralArchitectureFreezeReady: true
pcbFabAuthorized: false
productionReady: false
