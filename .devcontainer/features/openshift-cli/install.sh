#!/usr/bin/env bash
set -euo pipefail

version="${VERSION:?OpenShift client version is required}"
case "$(uname -m)" in
  x86_64|amd64) arch="x86_64" ;;
  aarch64|arm64) arch="aarch64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

base="https://mirror.openshift.com/pub/openshift-v4/${arch}/clients/ocp/${version}"
tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT

archive="openshift-client-linux.tar.gz"
curl --fail --location --silent --show-error "${base}/${archive}" -o "${tmpdir}/${archive}"
curl --fail --location --silent --show-error "${base}/sha256sum.txt" -o "${tmpdir}/sha256sum.txt"
expected="$(awk -v file="${archive}" '$2 == file || $2 == "*" file { print $1; exit }' "${tmpdir}/sha256sum.txt")"
if [[ ! "${expected}" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "Official checksum entry missing for ${archive} at ${base}" >&2
  exit 1
fi
printf '%s  %s\n' "${expected}" "${archive}" | (cd "${tmpdir}" && sha256sum --check --status)

tar -xzf "${tmpdir}/${archive}" -C "${tmpdir}" oc kubectl
install -m 0755 "${tmpdir}/oc" /usr/local/bin/oc
install -m 0755 "${tmpdir}/kubectl" /usr/local/bin/kubectl
