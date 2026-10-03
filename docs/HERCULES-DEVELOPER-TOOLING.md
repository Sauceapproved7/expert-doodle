# Hercules Developer Tooling Baseline

This repository keeps the editor layer intentionally small. Local tooling exists to shorten the feedback loop; repository tests and GitHub gates remain authoritative.

## Recommended workspace extensions

The repository recommends:

- GitHub Pull Requests and Issues for PR/review context.
- GitHub CodeQL for security-query inspection and triage.
- GitHub Actions for workflow editing and CI feedback.
- GitLens for history, blame, branch, and change context.
- Red Hat YAML for schema-aware YAML validation.
- Red Hat OpenShift Toolkit for OpenShift workflows.
- Kubernetes Tools for cluster and manifest workflows.
- Microsoft Container Tools for Docker/Podman workflows.
- ESLint for JavaScript/TypeScript diagnostics when a project config is present.
- Prettier for formatting when a project config is present.
- REST Client for checked-in, credential-free HTTP request examples.
- EditorConfig support for repository formatting defaults.
- Error Lens for high-visibility inline diagnostics.
- Terraform tooling when Hercules infrastructure is authored in HCL.

These are recommendations, not a substitute for repository policy.

## Authority order

Use this order when local tooling and repository automation disagree:

1. Repository security and governance rules.
2. Pull-request and main-branch GitHub gates.
3. Checked-in tests, linters, schema validators, and build scripts.
4. Workspace/editor diagnostics.
5. Personal editor preferences.

Never weaken a required CI/security gate to make an editor plugin happy.

## Security rules

- Do not store tokens, cookies, passwords, private keys, production certificates, or live secrets in editor settings, REST request files, launch configurations, or workspace files.
- Keep production credentials outside the repository and use approved secret providers.
- Treat AI coding extensions as optional. Do not make them part of the required baseline or allow them to bypass tests, provenance, authorization, or review controls.
- Keep generated manifests and gateway/API configuration reviewable in source control.
- Run fast local checks for feedback, but rely on GitHub gates for merge authority.
- For DPoP, OAuth, mTLS, gateway, cryptography, identity, payments, and other security-sensitive changes, require focused regression tests plus the full repository security gates.

## Extension maintenance

Review the recommendation list periodically. Remove extensions that are deprecated, duplicate built-in capabilities, create unacceptable data-handling risk, or no longer improve defect detection, review quality, deployment safety, or incident diagnosis.

Workspace recommendations must not introduce runtime dependencies into Hercules.


## Workload-specific OpenShift additions

Do not install every Red Hat extension by default. Add these only when the corresponding workload exists:

- `redhat.vscode-openshift-java-pack` for Java services targeting OpenShift.
- `redhat.java`, `vscjava.vscode-java-debug`, `vscjava.vscode-java-test`, and `vscjava.vscode-maven` for Java-specific repositories.
- `redhat.vscode-quarkus` for Quarkus services.
- `redhat.devspaces-remote-ssh` only when using OpenShift Dev Spaces.
- `redhat.vscode-knative` only for Knative/serverless workloads; prefer the current OpenShift Toolkit workflow where it covers the use case.
- `redhat.vscode-kaoto` and `redhat.apache-camel-extension-pack` only for Apache Camel/Fuse integration workloads.

The deprecated `redhat.project-initializer` and generic `formulahendry.code-runner` are explicitly discouraged for this repository.

## OpenShift safety rules

- Keep `oc`, `kubectl`, `helm`, Ansible, manifest validation, and deployment checks scriptable and represented in CI.
- Do not commit kubeconfigs, OpenShift login tokens, pull secrets, registry credentials, private keys, Ansible Vault passwords, or cloud credentials.
- Do not use privileged workloads or cluster-admin access to paper over SCC/RBAC failures.
- Do not treat valid YAML as proof of a safe deployment. Validate RBAC, SCC compatibility, resource limits, network policy, image provenance, and rendered manifests.
- Prefer least-privilege development kubeconfigs and never mount an entire production `~/.kube` directory into a development container.
