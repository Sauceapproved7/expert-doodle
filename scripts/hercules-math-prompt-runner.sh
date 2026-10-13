#!/usr/bin/env bash
# First-party Hercules fixed-prompt lab runner: no external network or customer data.
set -euo pipefail
read -r cpu_quota cpu_period < /sys/fs/cgroup/cpu.max
memory_limit="$(cat /sys/fs/cgroup/memory.max)"
test "$cpu_quota" = 10000
test "$cpu_period" = 100000
test "$memory_limit" = 536870912

/llama-bin/llama-server \
  --model /candidate.gguf --alias hercules-trial \
  --host 127.0.0.1 --port 18773 --ctx-size 512 \
  --parallel 1 --threads 1 --no-webui > /tmp/math-server.log 2>&1 &
model_pid="$!"
trap 'kill "$model_pid" 2>/dev/null || true' EXIT
ready=0
for i in $(seq 1 80); do
  if ! kill -0 "$model_pid" 2>/dev/null; then
    echo "model-server-exited-before-ready" >&2; exit 1
  fi
  if (
    exec 9<>/dev/tcp/127.0.0.1/18773
    printf 'GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&9
    IFS= read -r -t 2 line <&9
    [[ "$line" == 'HTTP/1.1 200'* ]]
  ) 2>/dev/null; then ready=1; break; fi
  sleep 1
done
test "$ready" = 1
echo "HERCULES_CPU_QUOTA=$cpu_quota"
echo "HERCULES_CPU_PERIOD=$cpu_period"
echo "HERCULES_MEMORY_LIMIT=$memory_limit"
for case_id in addition compare subtraction; do
  case "$case_id" in
    addition) question='What is 2 plus 2? Reply with the number only.';;
    compare) question='Which number is larger: 7 or 12? Reply with the larger number only.';;
    subtraction) question='What is 5 minus 3? Reply with the number only.';;
  esac
  for mode in baseline system; do
    if [[ "$mode" == system ]]; then
      instructions='Answer arithmetic and comparisons carefully. Compute before replying. Use one number only. If unsure, say UNKNOWN.'
      messages="[{\"role\":\"system\",\"content\":\"$instructions\"},{\"role\":\"user\",\"content\":\"$question\"}]"
    else
      messages="[{\"role\":\"user\",\"content\":\"$question\"}]"
    fi
    request="{\"model\":\"hercules-trial\",\"messages\":$messages,\"max_tokens\":28,\"temperature\":0,\"stream\":false}"
    request_bytes="$(printf '%s' "$request" | wc -c)"
    output="/tmp/$case_id-$mode.http"
    started="$(date +%s%3N)"
    (
      exec 3<>/dev/tcp/127.0.0.1/18773
      printf 'POST /v1/chat/completions HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nAccept: application/json\r\nContent-Length: %s\r\nConnection: close\r\n\r\n' "$request_bytes" >&3
      printf '%s' "$request" >&3
      timeout 60s cat <&3 > "$output"
    )
    elapsed="$(( $(date +%s%3N) - started ))"
    test -s "$output"
    test "$(wc -c < "$output")" -le 18000
    label="$(printf '%s_%s' "$case_id" "$mode" | tr '[:lower:]' '[:upper:]')"
    printf 'HERCULES_CASE_%s_MS=%s\n' "$label" "$elapsed"
    printf 'HERCULES_CASE_%s_HTTP=%s\n' "$label" "$(base64 -w0 "$output")"
  done
done
model_rss_kb="$(grep '^VmHWM:' "/proc/$model_pid/status" | tr -s ' ' | cut -d ' ' -f2)"
test -n "$model_rss_kb"
test "$model_rss_kb" -gt 0
echo "HERCULES_PROCESS_PEAK_RSS_BYTES=$((model_rss_kb * 1024))"
echo "HERCULES_MEMORY_PEAK=$(cat /sys/fs/cgroup/memory.peak)"
