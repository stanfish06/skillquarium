#!/usr/bin/env bash
npx skills add . -s * -g && git restore .

# graphify is a separate Python CLI + assistant skill (not managed by the skills
# CLI), so it needs its own installer. PyPI package is `graphifyy` (double-y); the
# CLI command is `graphify`. See: github.com/safishamsi/graphify
if ! command -v graphify >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv tool install graphifyy
  elif command -v pipx >/dev/null 2>&1; then
    pipx install graphifyy
  else
    pip install graphifyy || pip install graphifyy --break-system-packages
  fi
fi

# Register the graphify skill with your assistant. No args auto-detects the
# current platform (writes e.g. ~/.claude/skills/graphify/). Add more as needed:
#   graphify install --platform codex
#   graphify install --platform cursor
graphify install
