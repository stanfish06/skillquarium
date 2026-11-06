---
name: suricata-offline-evejson
description: Running Suricata against PCAPs offline and validating results via eve.json
---

# Suricata Offline Mode + EVE JSON

This skill covers running Suricata 7.x (checked against 7.0.11) against PCAPs offline and validating results via `eve.json`.
See also: `pcap-triage-tshark` for inspecting the PCAP itself.

## Run Suricata on a PCAP
Typical offline invocation:

```bash
suricata -c <suricata.yaml> -S <rules> -k none -r <pcap> -l /tmp/suri
```

Flags:
- `-r <pcap>`: replay a PCAP offline
- `-S <rules>`: load only the specified rules file
- `-l <dir>`: log directory (will contain `eve.json`)
- `-k none`: do not drop packets with bad checksums (common in captured/offloaded traffic)
- `-T`: test config and rules, then exit (non-zero if a rule fails to parse)
- `--runmode single`: one worker thread; deterministic ordering, easier debugging
- `-v`: more verbose console output

## Inspect alerts in EVE JSON
Count alerts:

```bash
jq -r 'select(.event_type=="alert") | .alert.signature_id' /tmp/suri/eve.json | wc -l
```

See alert ids and messages:

```bash
jq -r 'select(.event_type=="alert") | [.alert.signature_id,.alert.signature] | @tsv' /tmp/suri/eve.json
```

## Practical tips
- Check for rule parse errors: a normal run logs them and skips the bad rule (exit status stays 0), so read `<log-dir>/suricata.log` (look for `Error` lines and the `rules successfully loaded, N rules failed` summary) or run `-T` first.
- Use a fresh `-l` directory per run to avoid mixing logs.
- Ensure your rule triggers only on the intended traffic by testing positive and negative PCAPs.

## Tight feedback loop (recommended)
When iterating on a rules file, use this loop (`<pos.pcap>` should alert, `<neg.pcap>` should not):

```bash
# 1) Validate rule syntax
suricata -T -c <suricata.yaml> -S <rules>

# 2) Run on known-positive traffic
pos_dir=$(mktemp -d)   # fresh dir per run: Suricata appends to an existing eve.json
suricata -c <suricata.yaml> -S <rules> -k none -r <pos.pcap> -l "$pos_dir"
jq -r 'select(.event_type=="alert") | .alert.signature_id' "$pos_dir/eve.json" | sort -n | uniq -c

# 3) Run on known-negative traffic
neg_dir=$(mktemp -d)
suricata -c <suricata.yaml> -S <rules> -k none -r <neg.pcap> -l "$neg_dir"
jq -r 'select(.event_type=="alert") | .alert.signature_id' "$neg_dir/eve.json" | sort -n | uniq -c
```

For a one-command summary, run `bash scripts/run_suricata_offline.sh <pcap> <rules> [log-dir]` from this skill folder. It reads the config from `SURICATA_CONFIG` (default `/etc/suricata/suricata.yaml`), uses a new temp dir unless you pass a new or empty `log-dir`, and prints Suricata's output and `suricata.log` tail on failure.
