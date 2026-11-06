#!/usr/bin/env bash
set -euo pipefail

pcap="${1:-}"
rules="${2:-}"
if [[ -z "$pcap" || -z "$rules" ]]; then
  echo "Usage: $0 <pcap_path> <rules_path> [log_dir]" >&2
  echo "  log_dir must be new or empty (default: a fresh mktemp dir)." >&2
  echo "  SURICATA_CONFIG sets the config file (default: /etc/suricata/suricata.yaml)." >&2
  exit 2
fi
for f in "$pcap" "$rules"; do
  if [[ ! -f "$f" ]]; then
    echo "Not a file: $f" >&2
    exit 2
  fi
done

config="${SURICATA_CONFIG:-/etc/suricata/suricata.yaml}"

# Never delete a caller-supplied dir: accept only a new or empty one
if [[ -z "${3:-}" ]]; then
  log_dir="$(mktemp -d "${TMPDIR:-/tmp}/suri.XXXXXX")"
else
  log_dir="$3"
  if [[ "$log_dir" == "/" ]]; then
    echo "Refusing log_dir '/'." >&2
    exit 2
  fi
  if [[ -e "$log_dir" && ! -d "$log_dir" ]]; then
    echo "log_dir exists and is not a directory: $log_dir" >&2
    exit 2
  fi
  if [[ -d "$log_dir" && -n "$(ls -A "$log_dir")" ]]; then
    echo "log_dir is not empty: $log_dir (Suricata appends to existing logs; pass a new or empty dir)." >&2
    exit 2
  fi
  mkdir -p "$log_dir"
fi
echo "Log dir: $log_dir" >&2

rc=0
suricata -c "$config" -S "$rules" -k none -r "$pcap" -l "$log_dir" >"$log_dir/suricata.out" 2>&1 || rc=$?
if [[ $rc -ne 0 ]]; then
  echo "suricata exited with status $rc. Console output:" >&2
  tail -n 30 "$log_dir/suricata.out" >&2
  if [[ -f "$log_dir/suricata.log" ]]; then
    echo "--- suricata.log (tail) ---" >&2
    tail -n 30 "$log_dir/suricata.log" >&2
  fi
  exit "$rc"
fi

# Rule parse errors do not change the exit status; show them and the load summary
if [[ -f "$log_dir/suricata.log" ]]; then
  grep -E "Error|rules successfully loaded" "$log_dir/suricata.log" >&2 || true
fi

if [[ ! -f "$log_dir/eve.json" ]]; then
  echo "No eve.json produced; see $log_dir/suricata.out and $log_dir/suricata.log." >&2
  exit 1
fi

echo "Alerts (signature_id -> count):"
jq -r 'select(.event_type=="alert") | .alert.signature_id' "$log_dir/eve.json" \
  | sort -n \
  | uniq -c \
  | awk '{print $2"\t"$1}'
