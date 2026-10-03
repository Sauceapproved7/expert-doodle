# SoundWorld V1 — CAD-Ready Chassis Specification 01

All dimensions below are EVT CAD study values, not production-certified structural limits.

## Coordinate system / envelope
Origin at enclosure geometric center. X = left/right along 360 mm width; Y = front/rear along 150 mm depth; Z = bottom/top along 160 mm height.

## Structural study values
- outer shell nominal wall: 3.0 mm
- front acoustic baffle nominal wall: 4.0 mm
- minimum three internal brace planes tying front structure to rear/chassis structure without obstructing acoustic flow
- minimum eight distributed enclosure fastening zones
- replaceable gasket interfaces for main service panel, USB-C/service access and battery cassette
- critical bosses/ribs receive local fillets; sharp internal stress risers avoided

## Front acoustic layout
Maintain mirror symmetry about X=0.
- two mid-bass mounting regions centered left/right of centerline
- two tweeter regions positioned symmetrically and clear of handle/chassis shadow
Exact center coordinates remain parametric until driver flange CAD and diffraction study are imported.
No battery/electronics mass mounts directly to driver basket fasteners.

## Passive radiator ends
One PR centered on each X end zone. Reserve full front/back excursion clearance plus structural tolerance. Impact guard geometry cannot touch the moving diaphragm/surround under intended drop deformation.

## Internal zones
- acoustic net chamber target: 5.3 L after displacement accounting
- battery cassette: dedicated lower/rear central zone, preliminary minimum 99 × 56 × 83 mm plus harness/service clearance
- power/amplifier: thermally separated service zone
- DSP/control: separated from high-current switching paths
- antenna: upper nonmetal-obstructed keep-out zone
- harness corridors cannot cross PR sweep or pinch against service panel

## Service architecture
Rear service panel is mechanically removable without disturbing the primary front baffle. Battery cassette has a keyed disconnect accessible after service-panel removal. Seals are replaceable and individually identified by revision.

## Structural verification before production
FEA/modal study; baffle resonance study; fastener pull-out/torque study; handle proof load; battery retention shock; controlled drop sequence; gasket compression mapping; ingress pre-compliance; post-drop acoustic leak/impedance check.

cadReady: true for detailed EVT modeling
toolingReady: false
productionReady: false
