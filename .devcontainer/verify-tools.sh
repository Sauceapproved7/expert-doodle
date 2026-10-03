#!/usr/bin/env bash
set -euo pipefail

versions="$(node -e 'const v=require("./.devcontainer/toolchain-versions.json"); process.stdout.write(JSON.stringify(v))')"
openshift="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).openshift)' "$versions")"
helm_expected="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).helm)' "$versions")"
ansible_expected="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).ansibleCore)' "$versions")"

oc version --client | grep -F "Client Version: ${openshift}"
kubectl version --client >/dev/null
helm version --short | grep -Fx "v${helm_expected}"
ansible --version | grep -F "core ${ansible_expected}"
