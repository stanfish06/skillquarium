#!/usr/bin/env bash
set -euo pipefail

npx skills add . -s '*' -g
git restore .

find_graphify() {
  if command -v graphify >/dev/null 2>&1; then
    command -v graphify
    return 0
  fi

  if command -v uv >/dev/null 2>&1; then
    uv_bin_dir=$(uv tool dir --bin 2>/dev/null || true)
    if [ -n "$uv_bin_dir" ] && [ -x "$uv_bin_dir/graphify" ]; then
      printf '%s\n' "$uv_bin_dir/graphify"
      return 0
    fi
  fi

  if command -v pipx >/dev/null 2>&1; then
    pipx_bin_dir=$(pipx environment --value PIPX_BIN_DIR 2>/dev/null || true)
    if [ -n "$pipx_bin_dir" ] && [ -x "$pipx_bin_dir/graphify" ]; then
      printf '%s\n' "$pipx_bin_dir/graphify"
      return 0
    fi
  fi

  return 1
}

install_graphify() {
  if command -v uv >/dev/null 2>&1; then
    uv tool install graphifyy
  elif command -v pipx >/dev/null 2>&1; then
    pipx install graphifyy
  elif command -v pip >/dev/null 2>&1; then
    if ! pip install graphifyy; then
      echo "ERROR: pip install graphifyy failed; install uv/pipx or use a virtualenv. Refusing to retry with --break-system-packages." >&2
      return 1
    fi
  else
    echo "ERROR: graphify is missing and no supported installer was found (uv, pipx, or pip)." >&2
    return 1
  fi
}

# graphify is a separate Python CLI + assistant skill (not managed by the skills
# CLI), so it needs its own installer. PyPI package is `graphifyy` (double-y); the
# CLI command is `graphify`. See: github.com/safishamsi/graphify
graphify_cmd=$(find_graphify || true)
if [ -z "$graphify_cmd" ]; then
  install_graphify
  graphify_cmd=$(find_graphify || true)
fi

if [ -z "$graphify_cmd" ]; then
  echo "ERROR: graphify installed, but the graphify executable was not found. Add the tool bin directory to PATH and retry." >&2
  exit 1
fi

# Register the graphify skill with your assistant. No args auto-detects the
# current platform (writes e.g. ~/.claude/skills/graphify/). Add more as needed:
#   graphify install --platform codex
#   graphify install --platform cursor
"$graphify_cmd" install
