const OWNER="SauceApproved enterprise LLC";

const pack=(id,productName,purpose,{requirements=[],evidence=[],differentiators=[],mainsPowerConstructionAllowed=false}={})=>Object.freeze({
  id,
  productName,
  purpose,
  implementationOwner:OWNER,
  ownedDesign:true,
  thirdPartyFinishedProductAllowed:false,
  externalHostedRuntimeAllowed:false,
  requirements:Object.freeze(requirements),
  requiredEvidence:Object.freeze(evidence),
  differentiators:Object.freeze(differentiators),
  mechanicalFreeze:false,
  schematicFreeze:false,
  firmwareFreeze:false,
  prototypeVerified:false,
  productionReady:false,
  mainsPowerConstructionAllowed
});

export function createStudioHardwareEngineeringProgram(){
  const packages=[
    pack(
      "soundworld-field-recorder",
      "SoundWorld Field Recorder",
      "Portable owned multitrack recorder for production audio with verified storage and clock state.",
      {
        requirements:["independent-track-inputs","low-latency-monitoring","owned-session-state","removable-or-serviceable-storage","timecode-clock-input","battery-and-external-dc-path"],
        evidence:["input-noise-measurement","gain-linearity-measurement","clock-drift-measurement","runtime-and-thermal-test","storage-write-stress-test"],
        differentiators:["Proof Spine Track Ledger","Recorder State Capsule"]
      }
    ),
    pack(
      "soundworld-wireless-creator",
      "SoundWorld Creator Wireless",
      "Owned creator/lavalier transmitter-receiver family with measured link evidence and fail-closed RF claims.",
      {
        requirements:["dual-transmitter-capable","local-safety-record-path","encrypted-control-link","battery-state-proof","latency-measurement","serviceable-clips-and-cables"],
        evidence:["rf-link-budget-measurement","packet-loss-measurement","latency-measurement","runtime-test","rf-emc-compliance-plan"],
        differentiators:["RF Truth Ledger","Local Safety Take"]
      }
    ),
    pack(
      "soundworld-room-reference",
      "SoundWorld Room Reference Node",
      "Owned room-reference node for calibrated level, noise-floor and decay measurements that feed Memory Grid.",
      {
        requirements:["measurement-microphone-input","reference-level-generator","temperature-humidity-sensing","room-decay-capture","calibration-profile-storage","memory-grid-handoff"],
        evidence:["microphone-calibration","level-linearity-test","noise-floor-validation","decay-repeatability-test","calibration-trace-record"],
        differentiators:["Room Memory Signature","Reference Confidence Gate"]
      }
    ),
    pack(
      "soundworld-clock",
      "SoundWorld Clock",
      "Owned audio/timecode clock bridge for recorder, camera and SoundWorld devices.",
      {
        requirements:["timecode-generation","audio-clock-reference","holdover-state","offset-measurement","battery-backup","proof-ledger-output"],
        evidence:["clock-jitter-measurement","frame-offset-test","holdover-drift-test","battery-runtime-test","thermal-stability-test"],
        differentiators:["Clock Truth Ledger","Drift Budget Guard"]
      }
    ),
    pack(
      "soundworld-service-bench",
      "SoundWorld Service Bench",
      "Owned repair and calibration fixture family for repeatable device release evidence.",
      {
        requirements:["device-fixture-system","electrical-safety-boundary","audio-test-loop","firmware-identity-check","calibration-artifact-capture","service-record-export"],
        evidence:["fixture-repeatability","reference-device-cross-check","electrical-safety-validation","calibration-artifact-verification","release-gate-test"],
        differentiators:["Golden Service Baseline","Repair Proof Capsule"]
      }
    ),
    pack(
      "soundworld-room-measure",
      "SoundWorld Room Measure",
      "Owned portable acoustic measurement kit for decay, noise and room-reference capture.",
      {
        requirements:["calibrated-capture-path","impulse-response-mode","noise-floor-mode","repeatability-check","room-id-binding","memory-grid-handoff"],
        evidence:["measurement-repeatability","reference-room-comparison","microphone-calibration","noise-floor-validation","timing-validation"],
        differentiators:["Room Drift Map","Acoustic Proof Spine"]
      }
    ),
    pack(
      "studio-sync-core",
      "Hercules Sync Core",
      "Owned studio sync appliance for timecode, genlock and production-clock truth.",
      {
        requirements:["timecode-distribution","genlock-distribution","per-port-lock-state","offset-measurement","holdover-mode","memory-grid-handoff"],
        evidence:["multi-node-lock-test","frame-offset-measurement","jitter-measurement","holdover-test","thermal-stability-test"],
        differentiators:["Clock Truth Ledger","Sync Blind Spot Gate"]
      }
    ),
    pack(
      "studio-signal-core",
      "Hercules Signal Core",
      "Owned signal-routing and patch-control layer with route identity and verification.",
      {
        requirements:["named-input-output-map","route-locks","loop-detection","signal-health-observation","manual-fallback","proof-receipt-export"],
        evidence:["route-continuity-test","signal-integrity-test","failover-route-test","latency-measurement","connector-cycle-test"],
        differentiators:["Signal Path Fingerprint","Route Proof Receipt"]
      }
    ),
    pack(
      "studio-storage-core",
      "Hercules Storage Core",
      "Owned production storage/data appliance architecture for verified ingest copies and continuity.",
      {
        requirements:["primary-and-mirror-path","checksum-verification","copy-state-ledger","capacity-monitoring","recovery-mode","project-identity-binding"],
        evidence:["sustained-write-test","checksum-recovery-test","mirror-loss-test","power-interruption-recovery","thermal-load-test"],
        differentiators:["Copy Truth Ledger","Project Storage Capsule"]
      }
    ),
    pack(
      "studio-position-nodes",
      "Hercules Spatial Node",
      "Owned position-sensing nodes for camera, microphone, light and grip geometry continuity.",
      {
        requirements:["node-identity","three-axis-position-state","orientation-state","reference-origin-calibration","battery-or-low-voltage-power","memory-grid-handoff"],
        evidence:["position-repeatability-test","orientation-repeatability-test","origin-recalibration-test","drift-over-time-test","multi-node-coherence-test"],
        differentiators:["Set Geometry Fingerprint","Delta-to-Set"]
      }
    ),
    pack(
      "studio-acoustic-kit",
      "Hercules Acoustic Kit",
      "Owned modular acoustic-treatment geometry and verification system for repeatable room response.",
      {
        requirements:["modular-treatment-elements","position-marking","room-plan-binding","safe-mounting-requirements","post-install-measurement","memory-grid-handoff"],
        evidence:["mounting-safety-review","before-after-decay-measurement","noise-floor-measurement","repeat-position-test","material-fire-safety-review"],
        differentiators:["Acoustic Layout Fingerprint","Treatment Proof Pair"]
      }
    ),
    pack(
      "studio-comms-slate",
      "Hercules Comms Slate",
      "Owned slate, tally and intercom coordination device family tied directly to shot identity.",
      {
        requirements:["shot-take-identity","visible-tally-state","audio-comms-channels","local-mute","timecode-display","proof-spine-event-log"],
        evidence:["tally-state-test","intercom-latency-test","timecode-display-test","battery-runtime-test","drop-and-button-cycle-test"],
        differentiators:["Shot Identity Lock","Tally Proof Event"]
      }
    ),
    pack(
      "studio-environment-node",
      "Hercules Environment Node",
      "Owned environmental sensing node for temperature, humidity, light and noise-floor state.",
      {
        requirements:["temperature-sensing","humidity-sensing","ambient-light-sensing","noise-floor-sensing","calibration-state","memory-grid-handoff"],
        evidence:["sensor-calibration","cross-device-repeatability","long-duration-drift-test","battery-runtime-test","environmental-range-test"],
        differentiators:["Environment Fingerprint","Blind Spot Sensor Gate"]
      }
    ),
    pack(
      "studio-redundancy-core",
      "Hercules Redundancy Core",
      "Owned continuity controller for alternate low-voltage power, storage and signal paths.",
      {
        requirements:["path-inventory","health-state-inputs","manual-failover","authorized-control-failover","proof-event-log","single-point-detection"],
        evidence:["path-loss-simulation","failover-timing-test","recovery-test","state-consistency-test","operator-override-test"],
        differentiators:["Single-Point Radar","Failover Proof Capsule"]
      }
    ),
    pack(
      "studio-calibration-kit",
      "Hercules Calibration Kit",
      "Owned reference-tool kit and registry for camera, display, audio, light and spatial calibration.",
      {
        requirements:["device-reference-identities","calibration-validity-windows","artifact-fingerprints","cross-check-workflow","expiry-gates","memory-grid-handoff"],
        evidence:["reference-device-validation","repeatability-test","expiry-gate-test","cross-check-test","artifact-integrity-test"],
        differentiators:["Calibration Truth Ledger","Reference Drift Alarm"]
      }
    ),
    pack(
      "studio-cable-power-map",
      "Hercules Cable + Power Map",
      "Owned low-voltage cable identity, route mapping and power-budget system with mains treated as a qualified safety boundary.",
      {
        requirements:["cable-identity-labels","signal-route-map","low-voltage-power-budget","circuit-assignment-record","load-warning","proof-map-export"],
        evidence:["continuity-test","connector-cycle-test","load-budget-review","qualified-electrical-safety-review","route-verification-test"],
        differentiators:["Cable Topology Fingerprint","Power Headroom Guard"],
        mainsPowerConstructionAllowed:false
      }
    )
  ];
  return Object.freeze({
    schema:"sauceapproved.studio.hardware-engineering/v1",
    implementationOwner:OWNER,
    buildMode:"hercules-owned",
    thirdPartyFinishedProductAllowed:false,
    externalHostedRuntimeAllowed:false,
    packages:Object.freeze(packages),
    rules:Object.freeze([
      "prototype-claims-require-measurement",
      "production-claims-require-applicable-safety-and-compliance",
      "mains-power-work-requires-qualified-electrical-safety-boundary",
      "memory-grid-evidence-is-measured-not-assumed",
      "proof-spine-preserved"
    ])
  });
}
