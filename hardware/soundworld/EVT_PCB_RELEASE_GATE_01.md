# SoundWorld V1 — EVT PCB Release Gate 01

## Evidence required
1. ERC clean or every exception dispositioned.
2. Power/ground review: battery/charger/amplifier high-current paths, digital rails, return-current paths and sense grounds.
3. USB-C review against current TPS25751 schematic checklist/EVM architecture, including TPS25751/BQ25792 integration and Type-C protection.
4. nRF5340 RF section checked against Nordic's applicable current package reference layout and antenna keep-out.
5. Audio timing review: 48 kHz family, I2S master/slave ownership, MCK/BCLK/LRCK timing across nRF5340/DSP/amplifier domains.
6. Thermal review: charger, primary buck, amplifiers, battery-adjacent board region and enclosure coupling.
7. Connector review: current rating, temperature rise, keying, retention, service cycles.
8. BOM traceability: exact MPN, package, lifecycle/source status and reference document revision.

## Layout rules
Do not improvise the nRF5340 RF matching/reference region. Keep switching nodes and Class-D output loops away from RF, audio clocks and high-impedance sensing. Place Type-C protection adjacent to the receptacle with short protection return paths. Preserve thermal copper/return paths required by exact package guidance.

## Release meaning
Passing this gate permits an EVT PCB fabrication quote/package. It does not authorize payment, fabrication order, production, certification, sale or performance claims.

evtPcbRelease: evidence-dependent
purchaseAuthorized: false
productionAuthorized: false
