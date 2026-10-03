# SoundWorld V1 — Owned Pack Sizing Freeze 01

## Selected EVT architecture
4S2P cylindrical-cell module using Molicel INR-21700-P45B as the EVT cell candidate.

Nominal arithmetic from manufacturer-published cell values:
- 8 cells total
- 4 cells in series × 2 parallel strings
- 3.6 V nominal/cell -> 14.4 V nominal pack
- 4.5 Ah/cell -> 9.0 Ah nominal pack capacity
- 16.2 Wh/cell -> 129.6 Wh nominal cell energy before pack-level losses/derating

## Why the energy target changed
The earlier 80–100 Wh range was a preliminary architecture target, not a frozen customer claim. 4S2P provides more endurance reserve and electrical headroom while preserving the 14.4 V bus. Enclosure mass/volume, thermal behavior, charging time, transport classification and actual runtime must now be re-correlated around the larger pack.

## Owned design boundary
SauceApproved owns the module architecture, mechanical cassette, bus/protection interface, sensing placement, service disconnect, firmware policy and integration. Molicel owns/manufactures the electrochemical cell.

## Mandatory physical gates
Authentic traceable cells; manufacturer/application approval as applicable; matched incoming characterization; cell spacing/retention; interconnect current/thermal validation; BMS/protection validation; fault testing; charger correlation; enclosure thermal assessment; transport evidence; applicable product safety evaluation.

No hand-assembled customer pack is authorized from this document.

evtCandidate: true
purchaseAuthorized: false
productionReady: false
claimReady: false
