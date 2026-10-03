#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const devcontainer = JSON.parse(fs.readFileSync(".devcontainer/devcontainer.json", "utf8"));
const versions = JSON.parse(fs.readFileSync(".devcontainer/toolchain-versions.json", "utf8"));
assert.match(devcontainer.image, /@sha256:[a-f0-9]{64}$/);
assert.equal(devcontainer.remoteUser, "node");
assert.equal(devcontainer.features["ghcr.io/devcontainers-extra/features/ansible:2.1.2"].version, versions.ansibleCore);
assert.equal(devcontainer.features["ghcr.io/devcontainers/features/kubectl-helm-minikube:1.3.1"].helm, versions.helm);
assert.equal(devcontainer.features["./features/openshift-cli"].version, versions.openshift);
assert.equal(versions.kubectl, "bundled-with-openshift-" + versions.openshift);
NODE

versions="$(node -e 'process.stdout.write(JSON.stringify(require("./.devcontainer/toolchain-versions.json")))')"
openshift="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).openshift)' "$versions")"
helm_expected="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).helm)' "$versions")"
ansible_expected="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).ansibleCore)' "$versions")"

oc version --client | grep -F "Client Version: ${openshift}"
kubectl version --client --output=json >/dev/null
helm version --short | grep -Eq "^v${helm_expected}([+ ]|$)"
ansible --version | grep -F "core ${ansible_expected}"
ansible-playbook --version | grep -F "core ${ansible_expected}"
