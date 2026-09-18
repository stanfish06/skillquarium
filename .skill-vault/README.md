# .skill-vault

The `skillquarium` CLI (Bun + TypeScript) and the data it reads. `skills/` is the Vercel skills
CLI's flat store and stays flat; everything under `vault/` is generated from it.

```sh
bun install --frozen-lockfile   # from .skill-vault/
bun test                        # bun run typecheck, bun run lint
./skillquarium build            # from the repo root: regenerate vault/
```

New skill ids go in `extraAssignments` in `src/build/categories.json`, else they land in
Uncategorized.

## Sync

`skills update` only touches `sourceType: github` lock entries, and skips one whose `skillPath` is
gone upstream. Local fixes to those skills go in `data/local-overrides.json`; anything else is
reverted on the next sync.

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
