#!/usr/bin/env bash
# Private Qwen model, native systemd, disposable ARM64 CI only.
set -euo pipefail
test "$(uname -m)" = aarch64
test "$(cat /proc/1/comm)" = systemd
test -f /tmp/hercules-qwen15/candidate.gguf
test -x /tmp/hercules-qwen15-build/bin/llama-server
for port in 18776 38900; do
  if curl -fsS --max-time 2 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
    echo "preexisting_model_listener_refused"; exit 1
  fi
done
id_token="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
unit_name="hercules-qwen15-isolated-ci-$id_token.service"
unit_path="/run/systemd/system/$unit_name"
root="/opt/hercules-qwen15-ci-$id_token"
env_path="/run/hercules-qwen15-ci-$id_token.env"
approval="/run/hercules-qwen15-ci-$id_token.approved"
source_unit="deploy/hercules-qwen15/hercules-qwen15-private.service"
node_path="$(command -v node)"
model_source="/tmp/hercules-qwen15/candidate.gguf"
engine_source="/tmp/hercules-qwen15-build/bin"
cleanup() {
  sudo systemctl stop "$unit_name" >/dev/null 2>&1 || true
  sudo rm -f "$unit_path" "$env_path" "$approval"
  sudo systemctl daemon-reload >/dev/null 2>&1 || true
  sudo systemctl reset-failed "$unit_name" >/dev/null 2>&1 || true
  sudo rm -rf "$root"
}
trap 'cleanup' EXIT
sudo install -d -m 0755 "$root" "$root/scripts" "$root/hercules-models" "$root/engine" "$root/weights"
sudo cp -a hercules-models/. "$root/hercules-models/"
sudo install -m 0644 scripts/hercules-qwen15-owner-host.mjs "$root/scripts/hercules-qwen15-owner-host.mjs"
sudo install -m 0644 /dev/null "$root/weights/candidate.gguf"
for rule in ProtectHome=yes PrivateTmp=yes IPAddressDeny=any IPAddressAllow=localhost MemoryMax=4G CPUQuota=200% RestartSec=30s; do
  test "$(grep -Fxc "$rule" "$source_unit")" -eq 1
done
ci_group="$(id -gn nobody)"
awk -v node="$node_path" -v root="$root" -v grp="$ci_group" \
    -v envfile="$env_path" -v gate="$approval" \
    -v weights="$model_source" -v engine="$engine_source" '
  /^Description=/ {print "Description=Hercules isolated native model CI"; next}
  /^User=/ {print "User=nobody"; next}
  /^Group=/ {print "Group=" grp; next}
  /^WorkingDirectory=/ {print "WorkingDirectory=" root; next}
  /^EnvironmentFile=/ {print "EnvironmentFile=" envfile; next}
  /^ConditionPathExists=/ {print "ConditionPathExists=" gate; next}
  /^ExecStart=/ {print "ExecStart=" node " " root "/scripts/hercules-qwen15-owner-host.mjs"; next}
  /^\[Install\]$/ {
    print "BindReadOnlyPaths=" weights ":" root "/weights/candidate.gguf";
    print "BindReadOnlyPaths=" engine ":" root "/engine";
    print; next
  }
  {print}
' "$source_unit" | sudo tee "$unit_path" >/dev/null
for rule in ProtectHome=yes PrivateTmp=yes IPAddressDeny=any IPAddressAllow=localhost MemoryMax=4G CPUQuota=200%; do
  test "$(sudo grep -Fxc "$rule" "$unit_path")" -eq 1
done
sudo systemd-analyze verify "$unit_path"
export HERCULES_MODEL_TOKEN
HERCULES_MODEL_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
umask 077
printf 'HERCULES_QWEN15_PRIVATE_TRIAL=true\nHERCULES_QWEN15_MODEL_FILE=%s\nHERCULES_QWEN15_LLAMA_SERVER=%s\nHERCULES_MODEL_TOKEN=%s\n' \
  "$root/weights/candidate.gguf" "$root/engine/llama-server" "$HERCULES_MODEL_TOKEN" \
  | sudo tee "$env_path" >/dev/null
sudo chmod 600 "$env_path"
sudo touch "$approval"
sudo chmod 600 "$approval"
sudo systemctl daemon-reload
sudo systemctl start "$unit_name"
ready=0
for i in $(seq 1 110); do
  if curl -fsS --max-time 2 http://127.0.0.1:38900/health >/dev/null 2>&1; then ready=1; break; fi
  if [[ "$(sudo systemctl show "$unit_name" -p ActiveState --value)" = "failed" ]]; then break; fi
  sleep 1
done
if test "$ready" != 1; then
  echo "systemd_real_qwen_initial_start_failed"
  sudo systemctl show "$unit_name" -p ActiveState -p Result -p NRestarts -p ExecMainStatus -p ConditionResult --no-pager
  # Emit only preapproved machine diagnostics: no environment, token, or
  # arbitrary model responses/paths in CI logs.
  sudo journalctl -u "$unit_name" -n 60 --no-pager --output=cat | \
    grep -E 'owner_host_preflight_failed|private_model_unavailable|Failed at step|Failed to set up|Failed to mount|Main process exited|status=[0-9]+|Permission denied|Start request repeated too quickly' | \
    tail -n 18 || true
  exit 1
fi
node scripts/hercules-qwen15-private-live-smoke.mjs
main_pid="$(sudo systemctl show "$unit_name" -p MainPID --value)"
[[ "$main_pid" =~ ^[0-9]+$ ]]
test "$main_pid" -gt 1
test -r "/proc/$main_pid/task/$main_pid/children"
read -r model_child_pid extra_children <<< "$(cat "/proc/$main_pid/task/$main_pid/children")"
test -n "$model_child_pid"
test -z "$extra_children"
[[ "$model_child_pid" =~ ^[0-9]+$ ]]
test "$model_child_pid" -gt 1
sudo kill -KILL "$model_child_pid"
# Deny requests before systemd's real 30s restart delay completes.
closed=0
for i in $(seq 1 22); do
  if ! curl -fsS --max-time 1 http://127.0.0.1:38900/health >/dev/null 2>&1 &&
     ! curl -fsS --max-time 1 http://127.0.0.1:18776/health >/dev/null 2>&1; then
    closed=1; break
  fi
  sleep 1
done
test "$closed" = 1
recovered=0
for i in $(seq 1 140); do
  restarts="$(sudo systemctl show "$unit_name" -p NRestarts --value)"
  [[ "$restarts" =~ ^[0-9]+$ ]]
  if test "$restarts" -ge 1 &&
     curl -fsS --max-time 2 http://127.0.0.1:38900/health >/dev/null 2>&1; then
    recovered=1; break
  fi
  if [[ "$(sudo systemctl show "$unit_name" -p ActiveState --value)" = "failed" ]]; then break; fi
  sleep 1
done
if test "$recovered" != 1; then
  echo "systemd_real_qwen_restart_failed"
  sudo systemctl show "$unit_name" -p ActiveState -p Result -p NRestarts --no-pager
  exit 1
fi
test "$restarts" -eq 1
node scripts/hercules-qwen15-private-live-smoke.mjs
sudo systemctl stop "$unit_name"
for port in 18776 38900; do
  if curl -fsS --max-time 2 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
    echo "systemd_real_qwen_stale_listener"; exit 1
  fi
done
if sudo journalctl -u "$unit_name" --no-pager --output=cat | grep -Fq -- "$HERCULES_MODEL_TOKEN"; then
  echo "systemd_real_qwen_credential_leak"; exit 1
fi
echo "systemd_real_qwen_recovery_verified: real model inference twice, one native restart, no stale ports."
