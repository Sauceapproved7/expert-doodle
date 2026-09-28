# SauceApproved Vintage Camera v1

The Vintage Camera is a browser-local Hercules Video surface at `/vintage-camera`. It captures from a user-approved camera or opens a local video file, renders a live split view of untouched source and processed look, and records a WebM clip when the browser supports canvas capture and MediaRecorder. The source file is never sent to the Studio server. Camera and microphone access are requested only after the user chooses them; microphone is off by default.

## Hercules differentiators

1. **Split-frame proof:** the same frame appears untreated on the left and styled on the right while the processed recording remains full frame. Creators can judge the effect before recording.
2. **Portable look recipe:** a JSON sidecar records stock, strength and grain without embedding personal footage. It makes a chosen look repeatable and auditable. Import and cross-device color matching are future work, not v1 claims.

Four original looks are Golden Hour, Street Tape, Silver Noir and Clean Archive. They are stylizations, not simulations certified to match a particular film stock or camera. Grain is randomized per frame. The raw camera stream is recorded separately only when the user presses Record; a loaded file is preserved as its original local blob. Local-file exports in v1 are silent. Camera capture includes audio only when the microphone checkbox was selected and permission granted. The tool does not use a model, cloud rendering, account storage or Studio's trusted Hercules Video execution bridge.

## Limitations and privacy

- Secure browser context and camera permission are required for live capture. Browsers without MediaRecorder/WebM or canvas capture cannot export processed footage. The controls report unsupported states.
- The browser may release object URLs when the tab closes; users must download wanted outputs before leaving. No draft or media is retained by a server.
- Recording settings do not guarantee a fixed output frame rate or resolution on every Android browser. Test a short export on the target device before claiming support for that browser.
- Studio's operator start/resume endpoints retain their separate default-deny behavior. Vintage Camera has no server mutation or upload endpoint.

## Market entry

The first audience is creators and small brands who shoot short videos on a phone and want a vintage tone without losing the source. The launch proof is a real 10–15 second scene with the live source/look split and a downloadable processed result. Disclose that export is local WebM and that clip-file audio is not preserved in v1. Do not claim a market-first filter or imply paid checkout is ready.

Organic sequence: (1) a split-screen streetwear/product shot, (2) one scene in four stocks, (3) a behind-the-scenes recipe share, (4) a creator's own short clip with permission, (5) a clear call to try the free preview or request founding access. Track visits → permission granted or clip loaded → recording started → download completed → pilot request. Only publish actual footage and results. Paid pricing, refund terms and checkout require the existing owner approvals and verified payment path.

Current alternatives already offer retro grain/VHS filters and mobile capture. Positioning is the inspectable source/look workflow, local-first ownership and repeatable settings, not unsupported exclusivity.
