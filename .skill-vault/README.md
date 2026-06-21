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
| `build-graphify.py` | Rebuilds the optional local Graphify graph in `graphify-out/`. Manual only; can run LLM-backed extraction, so it is deliberately separate from CI's lightweight `build.py`. Run: `python3 .skill-vault/build-graphify.py` |
| `skill-lock.json` | Committed snapshot of the CLI's global provenance lock (`~/.agents/.skill-lock.json`). Records where each skill came from so CI can update them. |

## Scientific expert taxonomy

`.skill-vault/scientific-expert-taxonomy.json` is the authority for assigning
503 catalog profiles to 10 disciplines. The `scientific-agents` dispatcher is
separate and is not one of those 503 profiles. Generated maps, wrapper notes,
and Graphify output are views of the manifest, not classification sources.
Normal builds are deterministic and never classify profiles with heuristics or
an LLM.

When the upstream catalog adds or removes a profile, update the manifest in the
same change. Each profile has one `primary` discipline, may appear under
`secondary` disciplines as cross-disciplinary, and declares `bridge_domains`
that link discipline pages to broader capability maps.

The generated hierarchy starts at
`maps/scientific-expert-profiles.md`, with one page per discipline at
`maps/scientific-expert-profiles/<discipline-id>.md`. Discipline pages list
primary experts first, then cross-disciplinary experts, and expose relevant
capability-map bridges. Validate and rebuild in that order:

```sh
python3 -m unittest discover -s .skill-vault/tests -p 'test_*.py' -v
python3 .skill-vault/build.py
```

The builder validates the manifest against both the catalog and discovered
profile folders before writing any navigation files, so invalid or incomplete
assignments fail without a partial rebuild.

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
npx -y skills@1.5.10 update -g -y                        # updates the repo in place (pinned)
cp "$HOME/.agents/.skill-lock.json" .skill-vault/skill-lock.json
```

### Source coverage in CI

`skills update` only auto-updates skills whose lock entry is **`sourceType: github`**
(installed via `owner/repo` or an https GitHub URL): it diffs each skill's folder
hash against the GitHub API and reinstalls the ones that changed. Skills installed
from raw `git@github.com:…`/SSH remotes (`sourceType: git`) or local paths are
**not** auto-updated by the CLI — so every skill in this vault is kept as a `github`
source. If you later add a skill from an SSH remote, convert it once with

```sh
npx skills add <owner/repo> -s <skill> -g -y   # re-tracks it as a github source
```

`GITHUB_TOKEN` is only used to raise the API rate limit; all current sources are public.

## Keeping the lock snapshot fresh

When you **add or remove** skills locally with the CLI, refresh the snapshot so
CI knows about the change:

```sh
cp ~/.agents/.skill-lock.json .skill-vault/skill-lock.json
python3 .skill-vault/build.py        # regenerate nav for the new/removed skills
```

(The daily `update-skills.yml` run also refreshes the snapshot automatically.)

## Optional Graphify graph

For graph-backed local queries over the vault, rebuild `graphify-out/` manually:

```sh
python3 .skill-vault/build-graphify.py
```

By default this builds a lightweight graph over the navigation layer (root wrapper
notes, `maps/`, repo docs, and vault tooling). Use `--full` only when you really
want every skill folder included; that can be much slower and may consume LLM
tokens. Use `--dry-run` to see the exact `graphify` commands without rebuilding.
