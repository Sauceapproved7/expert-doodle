# SoundWorld V1 — Digital Power Tree Freeze 01

## Selected EVT regulator architecture
PACK_4S (14.4 V nominal) -> TPS62933 wide-input synchronous buck -> intermediate/main digital rail.
Intermediate rail -> TPS62840 low-IQ RF-friendly buck -> radio/always-on low-power rail where voltage/current requirements fit.

TPS62840 is prohibited from direct connection to the 4S battery bus because its input rating is below the pack voltage.

## Current architecture allocation
High-current audio power remains on its dedicated amplifier power domain.
Charger/USB-C power remains TPS25751 + BQ25792.
Main digital rail supplies DSP/control-support loads after exact rail-voltage review.
RF/low-power rail is isolated downstream to reduce idle draw and switching-noise coupling.

## Power budget method
Do not infer runtime from battery Wh divided by amplifier nameplate power. EVT logs average and peak draw separately for idle, connected-idle, voice, music, cinema, outdoor, max-safe playback, Hercules Link coordinator/member, charging-only, and playback-while-charging states.

## Thermal budget method
Record regulator input/output power and board temperatures at minimum/nominal/full pack voltage and representative loads. PCB copper, airflow, enclosure temperature and nearby amplifier heat are part of the thermal result.

## Remaining schematic items
Exact intermediate rail voltage; exact DSP/control rail currents; clock/oscillator selection; sensors; connector MPNs; ESD/EMI network; schematic ERC and layout review.

powerTreeFreezeReady: true
pcbFabAuthorized: false
productionReady: false
