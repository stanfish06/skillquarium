# .skill-vault

The `skillquarium` CLI (Bun + TypeScript) and the data it reads. `src/` holds one folder per
command group, `test/` mirrors it. `skills/` is the Vercel skills CLI's flat store and stays flat;
everything under `vault/` is generated from it.

```sh
bun install --frozen-lockfile   # from .skill-vault/
bun test                        # bun run typecheck, bun run lint
./skillquarium build            # from the repo root: regenerate vault/
```

New skill ids go in `extraAssignments` in `src/build/categories.json`, else they land in
Uncategorized. `test/python/` holds the one suite that stays Python, because the code it tests
ships inside four skills; `test/reviewFailure.test.ts` runs it under `bun test`.

`test/fixtures/graph.python.json` (5.4 MB, committed) is `vault/graph/graph.json` as the deleted
`kg/build_kg.py` produced it on this tree. `test/kg/parity.test.ts` deep-equals `buildGraph()`
against it; the three `test/search/` suites load it so their goldens stay comparable whatever the
current build writes. Nothing regenerates it, so a clone without it fails those four suites.

## Sync

`skills update` only touches `sourceType: github` lock entries, and skips an entry whose `skillPath` is gone upstream. `./skillquarium drift` lists both. Fixes to github-sourced skills go in `data/local-overrides.json` or the next sync reverts them; `./skillquarium overrides --check` reports any that stopped applying.

## Vendored bundles

| Bundle | Upstream | Vendored |
|--------|----------|----------|
| MATLAB Agentic Toolkit, 6 base groups, 30 skills | [matlab/matlab-agentic-toolkit](https://github.com/matlab/matlab-agentic-toolkit) @ `9556aee` | 2026-07-26 |
| 503 scientific expert profiles + `scientific-agents` | [K-Dense-AI/scientific-agents](https://github.com/K-Dense-AI/scientific-agents) @ `896ed6ed` | 2026-06 |

```sh
git clone https://github.com/K-Dense-AI/scientific-agents /tmp/scientific-agents
./skillquarium import scientific-agents /tmp/scientific-agents   # reapplies data/scientific-agent-patches.json
```

MATLAB: copy the group folders over `skills/matlab-*/`, keep each `LICENSE.md`.
