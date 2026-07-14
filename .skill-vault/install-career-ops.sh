#!/usr/bin/env bash

# Career Ops is a stateful workspace whose skill router depends on the full
# repository. Keep it outside this vault and delegate updates to its native
# updater instead of copying individual skill files here.
CAREER_OPS_SCAFFOLDER_VERSION="1.19.0"

apply_career_ops_update() {
  local career_ops_dir="$1"
  local claude_file="$career_ops_dir/CLAUDE.md"
  local saved_tail restored_file apply_status

  saved_tail="$(mktemp -t career-ops-claude-tail.XXXXXX)"
  restored_file="$(mktemp -t career-ops-claude-restored.XXXXXX)"

  if [ -f "$claude_file" ]; then
    sed -n '3,$p' "$claude_file" >"$saved_tail"
  else
    : >"$saved_tail"
  fi

  echo "career-ops: applying available update at $career_ops_dir..."
  if (cd "$career_ops_dir" && node update-system.mjs apply); then
    apply_status=0
  else
    apply_status=$?
  fi

  # The native updater replaces CLAUDE.md. Rebuild it from the new system
  # header plus the user's saved tail instead of appending blindly.
  if [ -s "$saved_tail" ]; then
    if [ -f "$claude_file" ]; then
      sed -n '1,2p' "$claude_file" >"$restored_file"
    else
      : >"$restored_file"
    fi
    sed -n '1,$p' "$saved_tail" >>"$restored_file"
    mv "$restored_file" "$claude_file"
  fi

  rm -f "$saved_tail" "$restored_file"

  if [ "$apply_status" -ne 0 ]; then
    echo "ERROR: career-ops update failed at $career_ops_dir." >&2
    return "$apply_status"
  fi

  echo "career-ops: updated at $career_ops_dir"
}

install_career_ops() {
  local career_ops_dir="${CAREER_OPS_DIR:-$HOME/career-ops}"
  local bootstrap_status check_output update_status

  if [ "${CAREER_OPS_SKIP:-0}" = "1" ]; then
    echo "career-ops: skipped (CAREER_OPS_SKIP=1)"
    return 0
  fi

  if [ ! -e "$career_ops_dir" ]; then
    echo "career-ops: initializing at $career_ops_dir..."
    if npx -y "@santifer/career-ops@$CAREER_OPS_SCAFFOLDER_VERSION" init "$career_ops_dir"; then
      echo "career-ops: initialized at $career_ops_dir"
      return 0
    else
      bootstrap_status=$?
      echo "ERROR: career-ops initialization failed at $career_ops_dir." >&2
      return "$bootstrap_status"
    fi
  fi

  if [ ! -d "$career_ops_dir/.git" ] || [ ! -f "$career_ops_dir/update-system.mjs" ]; then
    echo "ERROR: $career_ops_dir is not a valid Career Ops workspace; expected .git/ and update-system.mjs." >&2
    return 1
  fi

  if [ "${CAREER_OPS_AUTO_UPDATE:-1}" = "0" ]; then
    echo "career-ops: frozen at $career_ops_dir (CAREER_OPS_AUTO_UPDATE=0)"
    return 0
  fi

  # Automatic mode supersedes a dismissal recorded by an interactive session.
  rm -f "$career_ops_dir/.update-dismissed"

  if ! check_output="$(cd "$career_ops_dir" && node update-system.mjs check)"; then
    echo "ERROR: career-ops update check failed at $career_ops_dir." >&2
    return 1
  fi

  if ! update_status="$(printf '%s' "$check_output" | python3 -c '
import json
import sys

value = json.load(sys.stdin).get("status")
if not isinstance(value, str):
    raise ValueError("missing string status")
print(value)
' 2>/dev/null)"; then
    echo "ERROR: career-ops returned malformed update status." >&2
    return 1
  fi

  case "$update_status" in
    up-to-date)
      echo "career-ops: up to date at $career_ops_dir"
      ;;
    offline|no-remote-version)
      echo "WARNING: career-ops update check is $update_status; keeping the current workspace." >&2
      ;;
    update-available)
      apply_career_ops_update "$career_ops_dir"
      ;;
    *)
      echo "ERROR: unknown career-ops update status: $update_status" >&2
      return 1
      ;;
  esac
}
