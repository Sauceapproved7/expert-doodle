# DA-45 — Container-aware Qwen1.5B private-host CPU/RAM admission

The owner-host preflight must **never infer service RAM or CPU quotas merely from the physical machine**. Node's \`os.totalmem()\` may report host memory even inside a small memory-capped Linux container. Kernel cgroup v2 \`memory.max\`, \`memory.current\` and \`cpu.max\` define the container's enforceable memory/CPU budget. Legacy v1 uses \`memory.limit_in_bytes\`, \`memory.usage_in_bytes\`, \`cpu.cfs_quota_us\` and \`cpu.cfs_period_us\`.

Before reading model weights or spawning the private engine, \`inspectQwen15LocalHost\` derives conservative effective CPU count, total and unallocated RAM using \`Math.min\` of host and valid cgroup limits. If a controller exists but its values are unavailable or malformed, if the cgroup hierarchy is missing/unreadable, or if quota is under **2 CPUs**, **4 GiB total RAM**, **2 GiB currently free**, the private model process is refused. This is a conservative trial resource screen, **not** a production sizing, availability or zero-cost guarantee.

Tests cover v1 and v2, unlimited sentinels, fractional CPUs, 512MiB/0.1 vCPU service over a larger VM, high live memory use, malformed controller values, and an actual injected cgroup reading into the model host inspector. The earlier real native ARM64 runner's model memory high-water was **1,096,384,512 bytes** (~1.02 GiB) and per-session/OS needs are additional.

## Scope and provenance
- Private, 127.0.0.1-only Qwen1.5B launcher, explicit opt-in and owner-only bearer token unchanged.
- No cloud account, billing, VM, persistent volume, production service, checkout or Devbrain route mutated.
- Original standard-library Node code; Linux kernel interface only. References: https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html ; https://github.com/nodejs/node/issues/51095
- No production release approval; all model/service quality and cost gates remain false until independent verification.

Tests: \`node --test tests/hercules-qwen15-owner-host.test.mjs tests/hercules-qwen15-cgroup-budget.test.mjs\`.
