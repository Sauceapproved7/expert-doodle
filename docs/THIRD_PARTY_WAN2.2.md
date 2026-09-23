# Third-party notice — Wan2.2 runner

Hercules Video contains an optional runner wrapper for the separately installed **Wan2.2** project.

- Upstream: https://github.com/Wan-Video/Wan2.2
- Upstream license: Apache License 2.0
- Hercules does not vendor Wan2.2 source code or model weights in this repository.
- The runner invokes a user/operator-provided local Wan2.2 checkout through its documented `generate.py` CLI.
- The configured upstream commit and checkpoint checksum should be recorded with every rendered artifact.

The Apache 2.0 license requires preservation of applicable copyright, patent, trademark, attribution, and NOTICE information when redistributing the upstream Work or derivative copies. Because Hercules keeps the upstream checkout/model separate, their upstream license files and notices must remain with that installation.

Verified interface reference at integration time:
- `generate.py` blob SHA: `3a5cbcdd208e0acbe5c2c90478551660407ea26c`
- Official repository license: Apache License 2.0
