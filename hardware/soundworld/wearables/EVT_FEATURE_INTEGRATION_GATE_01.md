# SoundWorld Wearables — EVT Feature Integration Gate 01

## Evaluated microphone
TDK T5837 is the first shared microphone evaluation candidate. Manufacturer-published status/specifications: production, PDM digital output, 68 dBA SNR, 133 dB SPL AOP, 3.5 x 2.65 x 0.98 mm package. Suitability for each physical microphone position remains measurement-dependent.

## Pods mandatory differentiators
### Private Scene Mesh
EVT firmware must prove bounded event-class exchange with raw microphone audio prohibited from the mesh payload. Participation and event classes are opt-in. Test: packet/schema inspection, opt-out isolation, stale-peer behavior, RF coexistence and power impact.

### Case Guardian
EVT case controller must verify left/right firmware identity, retain an approved recovery reference, report battery-health imbalance and demonstrate bounded recovery from an intentionally invalid update state. Test must prove the case cannot bypass bud signing policy.

## Max mandatory differentiators
### Acoustic Twin
EVT factory calibration record must bind unit identity to measured acoustic reference data. Cushion/seal drift compensation is bounded. Recalibration creates a new signed state while preserving the original factory reference. Test: fixture repeatability, cushion swap, seal perturbation and rollback.

### Creator Monitor
EVT must provide a traceable neutral-monitor path that bypasses entertainment spatialization and personal Sound DNA coloration while retaining hard hearing protection. It exposes active calibration and transport/latency state. Test: DSP graph inspection plus measured response and latency over validated wired/USB transport.

## Gate
These four features are requirements, not marketing-only options. Neither product advances from architecture to EVT acceptance without its two feature tests passing.

No globally-exclusive claim is authorized by this gate.
