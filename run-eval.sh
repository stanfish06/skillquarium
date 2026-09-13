#!/usr/bin/env bash
# Entry point for the skill eval suite.
#   ./run-eval.sh              -> run
#   ./run-eval.sh replay [id]  -> re-score a saved run offline, no API calls
#   ./run-eval.sh report [id]  -> print a saved run's report
#   ./run-eval.sh runs         -> list saved runs
#   ./run-eval.sh selftest     -> offline: fixtures, configs, reference solutions through every gate
set -euo pipefail
cd "$(dirname "$0")/eval"

command -v mise >/dev/null || { echo "run-eval: mise is required (see mise.jdx.dev)" >&2; exit 1; }
mise trust --quiet . 2>/dev/null || true

case "${1:-run}" in
  run)    mise run setup && exec mise exec -- bun run src/cli.ts run "${@:2}" ;;
  replay) exec mise exec -- bun run src/cli.ts replay "${@:2}" ;;
  report) exec mise exec -- bun run src/cli.ts report "${@:2}" ;;
  runs)   exec mise exec -- bun run src/cli.ts runs ;;
  selftest) mise run setup && exec mise exec -- bun run src/cli.ts selftest ;;
  *)      echo "usage: $0 [run|replay|report|runs|selftest] [runId]" >&2; exit 2 ;;
esac
