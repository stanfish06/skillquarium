#!/usr/bin/env bash
set -euo pipefail

# This script lives at ~/.agents/skills/install-skills.sh
VAULT_DIR="$(cd "$(dirname "$0")" && pwd -P)"

npx skills add . -s '*' -g
git restore .

# Clean up stray gstack artifacts that `npx skills add . -s '*'` and gstack's
# own ./setup leak to the vault root. gstack sub-skills are navigated via the
# gstack/ bundle (build.py recurses into it), not as individual root-level skills.
# 1. Remove symlinks whose SKILL.md points into gstack/
find . -maxdepth 2 -name SKILL.md -type l -lname '*gstack*' -exec sh -c '
  dir=$(dirname "$1"); rm -rf "$dir"
' _ {} \; 2>/dev/null || true
# 2. Remove gstack-prefixed directories created by gstack ./setup --prefix
find . -maxdepth 1 -name 'gstack-*' -not -name 'gstack-*.md' -exec rm -rf {} \; 2>/dev/null || true

# ─── gstack (Garry Tan's AI engineering workflow) ───────────────
# gstack is a bundled skill collection — 23 specialist slash commands
# + 8 power tools that turn Claude Code into a virtual engineering team
# (CEO, eng manager, designer, reviewer, QA, security, release eng).
#
# It can't be split into per-skill folders because sub-skills share
# lib/, bin/, browse/ runtime code. Install it as a single bundle via
# its own ./setup script, which auto-detects installed agents (Claude
# Code, Codex, Cursor, Factory, Kiro, OpenCode) and symlinks the whole
# gstack/ folder into each agent's skills/ directory.
#
# Source: https://github.com/garrytan/gstack  ·  License: MIT
#
# Env flags:
#   GSTACK_SKIP=1         — skip gstack entirely
#   GSTACK_SKIP_BUN=1     — skip bun install (browser skills disabled;
#                           methodology skills still work via manual symlink)
#   GSTACK_REF=<ref>      — pin to a git ref (commit hash or tag). Defaults
#                           to a pinned commit below for reproducibility.
#                           Override to track main: GSTACK_REF=main
GSTACK_DIR="$VAULT_DIR/gstack"
GSTACK_REPO="https://github.com/garrytan/gstack.git"
# Pinned to a known-good commit (VERSION 1.58.4.0). Bump deliberately.
# Verify with: git -C gstack log -1 --format='%H %s' 9fd03fa
GSTACK_DEFAULT_REF="9fd03fae9e74f5daa7a138366aca8f86c7367c5c"
GSTACK_REF="${GSTACK_REF:-$GSTACK_DEFAULT_REF}"

install_gstack() {
  if [ -n "${GSTACK_SKIP:-}" ]; then
    echo "gstack: skipped (GSTACK_SKIP=1)"
    return 0
  fi

  # Clone or update — pinned to GSTACK_REF for reproducibility and
  # supply-chain safety. Override with GSTACK_REF=<ref> (e.g. main) to
  # track upstream.
  if [ -d "$GSTACK_DIR/.git" ]; then
    echo "gstack: updating to ref $GSTACK_REF..."
    git -C "$GSTACK_DIR" fetch --depth 1 origin "$GSTACK_REF" 2>/dev/null || true
    git -C "$GSTACK_DIR" checkout --detach "$GSTACK_REF" 2>/dev/null || \
      git -C "$GSTACK_DIR" checkout --detach FETCH_HEAD 2>/dev/null || true
  else
    echo "gstack: cloning (ref $GSTACK_REF)..."
    rm -rf "$GSTACK_DIR"
    git clone --no-checkout --depth 1 "$GSTACK_REPO" "$GSTACK_DIR" 2>/dev/null
    git -C "$GSTACK_DIR" fetch --depth 1 origin "$GSTACK_REF"
    git -C "$GSTACK_DIR" checkout --detach FETCH_HEAD
  fi

  if [ ! -x "$GSTACK_DIR/setup" ]; then
    echo "ERROR: gstack setup script not found at $GSTACK_DIR/setup" >&2
    return 1
  fi

  # gstack's ./setup requires bun to build the browse binary and install
  # playwright. Install bun if missing so the full toolkit works (/browse,
  # /qa, /design-shotgun, /make-pdf, /diagram). Skip with GSTACK_SKIP_BUN=1.
  if [ -z "${GSTACK_SKIP_BUN:-}" ] && ! command -v bun >/dev/null 2>&1; then
    echo "gstack: installing bun (required for browser skills)..."
    if command -v curl >/dev/null 2>&1; then
      # Download with TLS + retries, then execute (not piped directly) so
      # a network hiccup can't truncate the script mid-stream.
      bun_installer="$(mktemp)"
      trap 'rm -f "$bun_installer"' EXIT
      if curl --proto '=https' --tlsv1.2 --fail --location --retry 3 \
              --connect-timeout 10 -o "$bun_installer" \
              https://bun.sh/install 2>/dev/null; then
        bash "$bun_installer" 2>/dev/null || {
          echo "WARNING: bun install failed." >&2
          echo "  Install bun manually from https://bun.sh, or set GSTACK_SKIP_BUN=1" >&2
          echo "  to skip (only methodology skills will work)." >&2
          rm -f "$bun_installer"
          return 1
        }
      else
        echo "WARNING: failed to download bun installer." >&2
        rm -f "$bun_installer"
        return 1
      fi
      rm -f "$bun_installer"
      trap - EXIT
      export BUN_INSTALL="$HOME/.bun"
      export PATH="$BUN_INSTALL/bin:$PATH"
    else
      echo "WARNING: curl not found, cannot install bun. Set GSTACK_SKIP_BUN=1 to skip." >&2
      return 1
    fi
  fi

  # Run gstack's own installer — auto-detects agents, symlinks the bundle
  # into each, builds the browse binary, installs playwright browsers.
  # --no-prefix  → short skill names (/qa, /ship, /review) instead of /gstack-qa
  # --quiet      → suppress non-essential log output
  if [ -z "${GSTACK_SKIP_BUN:-}" ] && command -v bun >/dev/null 2>&1; then
    echo "gstack: running ./setup --host auto --no-prefix --quiet..."
    (cd "$GSTACK_DIR" && ./setup --host auto --no-prefix --quiet)
  else
    # Fallback: bun not available — manually symlink the bundle to each
    # installed agent. Browser-dependent skills won't work, but the pure
    # methodology skills (/office-hours, /plan-ceo-review, /review, /cso,
    # /spec, /retro, /autoplan, /careful, /freeze, /ship, /investigate) will.
    echo "gstack: bun not available — manual symlink fallback (browser skills disabled)..."
    for skills_dir in \
      "$HOME/.claude/skills" \
      "$HOME/.codex/skills" \
      "$HOME/.config/opencode/skills" \
      "$HOME/.cursor/skills" \
      "$HOME/.factory/skills" \
      "$HOME/.kiro/skills"; do
      parent="$(dirname "$skills_dir")"
      if [ -d "$parent" ] || [ -L "$parent" ]; then
        mkdir -p "$skills_dir"
        ln -snf "$GSTACK_DIR" "$skills_dir/gstack"
        echo "  linked $skills_dir/gstack"
      fi
    done
  fi

  echo "gstack: done. Skills: /office-hours /plan-ceo-review /review /qa /ship /cso /autoplan /spec /retro ..."
}

install_gstack

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
