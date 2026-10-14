# Third-party references — Glow Society preview

The application code in this folder is authored for SauceApproved/Hercules, with AI assistance. The demo does **not** bundle external JavaScript modules, model weights, photos or fonts into this repository. It requests the following independent assets at runtime:

| Asset | Source | License / usage | Notes |
| --- | --- | --- | --- |
| MediaPipe Tasks Vision, version 0.10.14 | https://www.npmjs.com/package/@mediapipe/tasks-vision | Apache-2.0 | Lazy-loaded for voluntary live-camera AR; not included in repository |
| MediaPipe face and hand landmarker model files | https://storage.googleapis.com/mediapipe-models/ | Provider model files | Third-party inference assets; verify separate model policies and production distribution permission before bundling |
| DM Sans font | https://fonts.google.com/specimen/DM+Sans | SIL Open Font License 1.1 | Hosted by Google Fonts; not included in repository |
| Playfair Display font | https://fonts.google.com/specimen/Playfair+Display | SIL Open Font License 1.1 | Hosted by Google Fonts; not included in repository |
| Example portrait | https://unsplash.com/license | Unsplash License | Linked by URL only; image/person rights and suitability require verification for public commercialization |
| GitHub Actions checkout | https://github.com/actions/checkout | MIT | Workflow references exact SHA approved by repo owner-code gate |

**Data handling:** Camera frames are processed by MediaPipe locally in the browser; the application does not directly upload them. MediaPipe states that the API may send utilization/performance metrics to Google. Before turning this into a public consumer app, provide appropriate disclosures/consent, document third-party telemetry, and independently test network traffic and privacy settings.

**License assessment:** The package and font licenses above generally allow use in a demo, but do not imply ownership of external libraries, hosted font resources, model files, likeness rights or product names. There is no claim of third-party code ownership and no provider source code is vendored. A later fully self-hosted build will need verified permissions and copies of license/notices.

This file is informational engineering provenance, not legal approval.
