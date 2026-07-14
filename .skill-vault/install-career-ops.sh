#!/usr/bin/env bash

# Career Ops is a stateful workspace whose skill router depends on the full
# repository. Keep it outside this vault and delegate updates to its native
# updater instead of copying individual skill files here.
CAREER_OPS_SCAFFOLDER_VERSION="1.19.0"

install_career_ops() {
  local career_ops_dir="${CAREER_OPS_DIR:-$HOME/career-ops}"
  local bootstrap_status

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
}
