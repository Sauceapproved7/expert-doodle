# DA-45 — Bounded systemd recovery: temporary native laboratory

This laboratory runs **only on an ephemeral GitHub Actions Ubuntu runner**, not a permanent host. It does not install Hercules, download Qwen, start the user's service, create any provider resources, or modify payments. There is **no paid hosting** operation.

The existing private Qwen service already declares `Restart=on-failure`, `RestartSec=30s`, `StartLimitIntervalSec=5min`, `StartLimitBurst=3`, and `KillMode=control-group`. The temporary GitHub workflow reads those settings **directly from the committed owner-private unit**, starts a uniquely named, non-root systemd transient test service which executes `/usr/bin/false` (always returns failure), then checks actual native systemd state. Success requires observed retries (`NRestarts >= 2` and `<= 3`) followed by `Result=start-limit-hit`. The transient unit is stopped/reset in cleanup and never enabled. No secret, model weight, inference endpoint, network listener or live API is used in this experiment.

This test proves the **systemd supervisor behavior** with real unit-configured recovery parameters. It is **not real model inference**, does not prove Qwen running under systemd or that the actual owner-host service would restart successfully on its final machine, and is **not a permanent host** or 24/7 uptime proof. Real ARM64 Qwen inference, clean shutdown and unexpected-child-failure propagation are separately evidenced in prior tests on disposable runners.

Before production, the remaining requirements include independently verified zero-extra-cost/acceptable-cost ARM64 owner hosting with >=4 GiB total RAM, effective >=2 CPUs, appropriate owner authorization, local secret provisioning, operational restart and incident testing, network isolation, sustained availability and authentic Devbrain verification. Keep paid checkout and public inference gates closed. Production main and deployed SauceApproved services must not change from this test.

Original Hercules test workflow; no third-party package, model, binary, or cloud VM is packaged.
