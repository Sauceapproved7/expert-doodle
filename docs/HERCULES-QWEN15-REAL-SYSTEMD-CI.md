# Hercules Qwen1.5B under real Linux systemd — temporary ARM64 CI

This is **ephemeral** GitHub Actions infrastructure, **not a production host**. The run uses the already-pinned Qwen2.5-1.5B model and llama.cpp engine built earlier in the same temporary workflow. It creates **no extra hosting** account, subscription, persistent resource, paid deployment, public endpoint, or production main merge.

The native systemd probe copies the authentic owner-private service configuration with its 30-second retry interval, memory limit, CPU quota, localhost-only firewall and security protections. It adapts only CI-specific filesystem paths and the unprivileged service account, creates a temporary owner authorization marker and restricted runtime credential file, and uses a read-only bind mount for model and engine paths while maintaining `PrivateTmp=yes` and `ProtectHome=yes`.

The runner must prove **actual Qwen** private authenticated inference, forcibly terminate **only its direct model subprocess**, observe fail-closed local endpoints, wait for **one genuine bounded restart** performed by systemd (not a manual restart), prove authenticated model inference again and stop the unit with both listeners closed. The test fails if credentials appear in systemd logs and destroys its temporary unit and files at exit.

This checks genuine native systemd restart of Qwen on disposable hardware. It does **not** prove actual permanent-machine uptime, cost or host ownership, a safe Devbrain production connection, customer authorization, or public inference. Separate owner authorization and independent provider cost verification remain mandatory before any real 24/7 service or commerce enablement.
