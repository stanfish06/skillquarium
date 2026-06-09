# .skill-vault — how this repo stays navigable

This repo is two layers over the same folders:

- **Agent layer** — each `<skill>/SKILL.md` is the real, executable skill. These
  are managed by the [Vercel skills CLI](https://github.com/vercel-labs/skills)
  (`npx skills`) and are **never edited by the tooling here**.
- **Human layer** — generated for Obsidian / Neovim navigation:
  - `<skill>.md` — a wrapper note per skill (your *Personal notes* section and
    your `status` / `rating` / `aliases` frontmatter edits survive every rebuild)
  - `maps/<domain>.md` — one map (MOC) per domain
  - `index.md` — the master A–Z + by-domain index

This directory holds the machinery that keeps the human layer in sync.

## Files

| File | Purpose |
|------|---------|
| `build.py` | Regenerates the human layer from the `SKILL.md` files. Idempotent; preserves hand edits. Run: `python3 .skill-vault/build.py` |
| `skill-lock.json` | Committed snapshot of the CLI's global provenance lock (`~/.agents/.skill-lock.json`). Records where each skill came from so CI can update them. |

## GitHub Actions

Two workflows in `.github/workflows/` (both share a `vault-write` concurrency
group so they never push at the same time):

1. **`rebuild-index.yml`** — on every push to `master` (and manual dispatch).
   Runs `build.py` and commits the regenerated navigation layer. Fast, no network.
2. **`update-skills.yml`** — daily at 06:17 UTC (and manual dispatch). Runs
   `npx skills update -g -y` to pull the latest version of every skill, refreshes
   `skill-lock.json`, rebuilds the navigation layer, and commits the result.

Bot commits use the default `GITHUB_TOKEN`, so they **do not** re-trigger the
workflows (no infinite loop); the `[skip ci]` marker is belt-and-suspenders.

### How CI updates skills in place

The CLI installs global skills into its canonical dir `~/.agents/skills` (this
repo) and tracks provenance in `~/.agents/.skill-lock.json` — which sits *above*
the repo and isn't committed. CI reconstructs that layout from the snapshot:

```sh
mkdir -p "$HOME/.agents"
ln -sfn "$GITHUB_WORKSPACE" "$HOME/.agents/skills"      # canonical dir -> checkout
cp .skill-vault/skill-lock.json "$HOME/.agents/.skill-lock.json"
npx -y skills@latest update -g -y                        # updates the repo in place
cp "$HOME/.agents/.skill-lock.json" .skill-vault/skill-lock.json
```

### Source coverage in CI

- `sourceType: github` (HTTPS, e.g. `K-Dense-AI/scientific-agent-skills`,
  `vercel-labs/skills`) update automatically via the GitHub API + `GITHUB_TOKEN`.
- `sourceType: git` (SSH `git@github.com:…` remotes, e.g. `ClawBio`,
  `nature-skills`) only update if you add a repo secret **`SKILLS_SSH_KEY`** (a
  read-capable SSH/deploy key). Without it those sources are skipped and the run
  still succeeds.

## Keeping the lock snapshot fresh

When you **add or remove** skills locally with the CLI, refresh the snapshot so
CI knows about the change:

```sh
cp ~/.agents/.skill-lock.json .skill-vault/skill-lock.json
python3 .skill-vault/build.py        # regenerate nav for the new/removed skills
```

(The daily `update-skills.yml` run also refreshes the snapshot automatically.)
