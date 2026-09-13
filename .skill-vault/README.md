# .skill-vault

Tooling behind the generated `vault/` layer. `skills/` is the Vercel skills CLI's flat store and stays flat.

```sh
python3 .skill-vault/build.py                                       # regenerate vault/
python3 -m unittest discover -s .skill-vault/tests -p 'test_*.py'   # after a rebuild
```

New skill ids go in `EXTRA_ASSIGNMENTS` in `build.py`, else they land in Uncategorized.

## Sync

`skills update` only touches `sourceType: github` lock entries, and skips an entry whose `skillPath` is gone upstream. `check-upstream-drift.py` lists both. Fixes to github-sourced skills go in `local-overrides.json` or the next sync reverts them.

## Vendored bundles

| Bundle | Upstream | Vendored |
|--------|----------|----------|
| MATLAB Agentic Toolkit, 6 base groups, 30 skills | [matlab/matlab-agentic-toolkit](https://github.com/matlab/matlab-agentic-toolkit) @ `9556aee` | 2026-07-26 |
| 503 scientific expert profiles + `scientific-agents` | [K-Dense-AI/scientific-agents](https://github.com/K-Dense-AI/scientific-agents) @ `896ed6ed` | 2026-06 |

```sh
git clone https://github.com/K-Dense-AI/scientific-agents /tmp/scientific-agents
python3 .skill-vault/import-scientific-agents.py /tmp/scientific-agents   # reapplies scientific-agent-patches.json
```

MATLAB: copy the group folders over `skills/matlab-*/`, keep each `LICENSE.md`.
