# Hercules Qwen 1.5B — Owner-private Linux service template

**This is a reviewable service definition, not an installed or live application. No VM was provisioned.** It stays on an isolated development branch until appropriate hosting is independently verified. It does not enroll in cloud accounts, accept hosting terms, create subscriptions, bypass authentication, or change the running SauceApproved store.

## Required host approval boundary

A future **owner-approved** CPU host must first have at least **4 GiB** RAM and an effective two-CPU quota, with >=2 GiB free at startup. The previously measured model-process peak was about 1.02 GiB; additional system and inference memory must be budgeted. The existing Render Free 512 MiB/0.1 CPU environment fails, even if its underlying physical machine is larger.

A real host requires independent cost verification, proven account permissions, security/update plan and appropriate spend limits before anyone enables this service. A temporary GitHub ARM64 runner is not an always-on VM or proof of production. Neither a service unit nor passing CI grants authorization to create a VM or incur costs.

Once those external requirements are independently met on a trusted host, this file specifies the future deployment contract:

- Install first-party Hercules code under \`/opt/hercules/current\`. The executable Node binary must exist at \`/usr/bin/node\`; service user/group \`hercules-ai\` must already be provisioned by an authorized operator.
- Install pinned, separately licensed llama.cpp and Qwen2.5-1.5B Q4_K_M model on local disk with correct permissions. The existing Hercules launcher checks the model's SHA256, effective Linux cgroup CPU/RAM limits and executable path.
- The secret environment file \`/etc/hercules/qwen15-private.env\` is **not** supplied in this repository. It must have restrictive filesystem access and contain the locally assigned model path, llama-server binary path, a strong owner-only \`HERCULES_MODEL_TOKEN\`, and the explicit opt-in \`HERCULES_QWEN15_PRIVATE_TRIAL=true\`. **Never place secrets in Git**, systemd unit text, chat, or an unprotected file.
- The approval marker \`/etc/hercules/qwen15-private.approved\` must also be created separately as part of the authorized host provisioning. Its absence makes systemd skip the unit. This is a local operational gate, **not** a signature or cloud billing verification.
- A qualified authorized operator can review the unit through \`systemd-analyze verify\`, install it in \`/etc/systemd/system\`, and perform \`systemctl daemon-reload\`, \`systemctl enable\`, \`systemctl start\`, \`systemctl status\` and \`systemctl stop\` as appropriate on that host. These actions are not executed by this pull request.
- The unit runs as non-root with a read-only system filesystem, protected home, isolated temp/device access, no new privileges, zero swap, bounded memory/CPU, and a restricted set of address families. \`IPAddressDeny=any\` plus \`IPAddressAllow=localhost\` further constrains networking; the Hercules and native-model endpoints bind only to \`127.0.0.1\`.
- Failed services restart after 30 seconds, but at most 3 starts in 5 minutes, preventing an unbounded crash loop. \`KillMode=control-group\` terminates the model child if the parent service is stopped. Secrets and model responses must never be included in health logs.

## Independent future admission

After initial installation, a protected \`/v1/chat\` request must generate a correct actual model response; invalid/missing bearer credentials must be rejected, while logs must show no secret leakage. Recovery must also be tested for forced model exit, hard memory limits, networking failure and reboot behavior. Confirm that \`systemctl\` reports successful bounded restart and that both services remain localhost-only.

**This is not proof of production.** Public API ingress, customer isolation, performance and concurrency guarantees, sustained uptime, incident/rollback operations, independent host ownership, provider credit balance, cost verification and a real authenticated Devbrain route (including authentic \`ai_ok\` status) remain unverified. Keep public signup, commerce and paid fulfillment gates closed. Do not use the unit as a reason to merge automatically into production \`main\`.

This is original Hercules operator configuration. It packages no Qwen GGUF weights or llama.cpp vendor code, and gives no third-party license ownership rights. Linux systemd resource semantics are documented by systemd.resource-control(5) and systemd.exec(5).
