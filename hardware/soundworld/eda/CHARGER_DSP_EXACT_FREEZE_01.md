# SoundWorld Speaker — Charger Lifecycle / DSP Exact Freeze 01

## ADAU1467
Production anchor: **ADAU1467WBCPZ300**.
Alternate reel ordering model: **ADAU1467WBCPZ300RL**.
Package: **88-lead LFCSP, 12 mm x 12 mm, exposed pad**.
Analog Devices lists both models as production and exposes CAD symbol/footprint model sources. CAD import must still be pin-map/land-pattern reviewed inside the actual EDA project before ERC release.

## BQ25792 lifecycle intervention
Existing EVT architecture referenced **BQ25792RQMR**, package RQM, 29-pin VQFN-HR, 4 mm x 4 mm.

Current TI support information states BQ25792 has been moved out of the normal catalog and recommends considering the improved **BQ25798**. Therefore:
- BQ25792RQMR remains an EVT/reference anchor only.
- It is NOT frozen as the SoundWorld production charger.
- BQ25798 receives a controlled migration review before the production schematic is frozen.
- No pin-compatible assumption is authorized without datasheet/package/interface comparison.
- TPS25751 integration must be revalidated against the selected production charger.

## Release consequence
The lifecycle finding intentionally blocks the first ERC release freeze until charger migration is dispositioned. This prevents a technically valid schematic from being based on a poor new-production sourcing choice.

lifecycleHold: true
ercReleaseReady: false
fabricationReady: false
purchaseAuthorized: false
productionReady: false
