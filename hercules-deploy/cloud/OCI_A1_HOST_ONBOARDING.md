# Hercules Cloud: Oracle Always Free A1 host requirements — source-only gate

## Verified public Oracle limits (checked October 13, 2026)

[Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) give up to **1,500 OCPU-hours and 9,000 GB-hours** monthly for Ampere A1. For an Always Free tenancy this equals **2 total OCPUs and 12 GB RAM**. You can allocate that to one or two A1 instances in your **home region**. The tenancy includes **200 GB combined boot + block-volume storage**, of which each VM's boot volume consumes at least 47–50 GB. Region/shape capacity is not guaranteed. Idle instances may be reclaimed, and out-of-region/premium resources can cost money. These values are allowances, not proof this user's OCI tenancy exists.

[Oracle Free Tier](https://www.oracle.com/cloud/free/) begins with a time-limited trial credit offer in eligible regions; the Always Free pool remains available after the trial if eligible. Oracle explicitly requires credit or debit card information for **identity verification**, and may place a temporary authorization hold. Payment/identity checks and provider terms are owner-only; no assistant or host agent should fabricate a tenancy or card. Do not select Pay As You Go, premium images, billable volumes, GPU instances or extra OCPU/memory without explicit owner decision.

## First real machine target

A defensible starter configuration when a real Oracle account and capacity become available:
- Shape: `VM.Standard.A1.Flex` ARM64, **2 OCPUs, 12 GB RAM**.
- OS: Oracle-supported Always Free Ubuntu **24.04 aarch64**.
- Boot volume: 50 GB Always Free eligible in the **home region**, subject to the total 200 GB allotment.
- Network: minimal private access; SSH access only to owner-approved principals. Do not expose the Docker Unix socket, model inference API, admin/control-plane listener or database publicly.
- Separate non-root Linux operator (UID >= 1000) with **rootless Docker** and Unix socket `/run/user/<uid>/docker.sock`. No rootful Docker daemon for Hercules signed-command execution.
- Automatic DNS cutover, storefront migration, billing, auto-deploy and public registration remain disabled.

This is a **desired setup**, not an instance order, account creation, provisioning record or a claim of total capacity for all Hercules AI workloads. Ampere ARM64 must be checked for compatible application and native-model binaries; a 2-OCPU instance cannot guarantee high AI throughput, customer concurrency or 100% uptime.

## Hardened local observation gate

`hercules-deploy/cloud/oci-a1-host-readiness.mjs` exports the pure, side-effect-free `assessOciA1Host(evidence,{now})` function. It recognizes recent Ubuntu 24.04 ARM64 readings with at least two visible CPUs, at least 10 GiB reported RAM (allowing OS reservations), 16 GiB actual free disk, a non-root UID, correct same-user Unix socket, and rootless Docker security observations. The evaluator does not read local files, execute processes, contact a provider, or accept static registry `verified:true` claims as evidence.

**It intentionally never returns verified provider ownership, verified cost, execution authority, verified host registration, or production approval, even if the local fields pass.** A real operator must independently check provider API tenancy+instance identity, owner agreement, exact Always Free billing status, Linux fingerprint, restricted SSH enrollment, persistent rootless runtime, durable replay vault, signed grant, and sandbox rollback, separately, before merging host-agent capabilities.

Test: `node --test tests/hercules-cloud-oci-a1-readiness.test.mjs`. The existing draft Hercules Cloud PR #948 remains stacked/unmerged and cannot run deployments. No host, billable resource or sensitive credential is created in this change.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
