A collection of AI agent skills, organized as an Obsidian vault for easier human navigation.

- managed by vercel's skills
- place at `~/.agents/skills`

## Screenshot
<table width="100%">
  <tr>
    <th>Obsidian graph</th>
    <th>Graphifyy graph</th>
  </tr>
  <tr>
     <td width="50%">
       <img src="./screenshot.png" width="300" />
     </td>
     <td width="50%">
       <img src="./graphifyy.png" width="300" />
     </td>
  </tr>
</table>

## Setup

```bash
git clone git@github.com:stanfish06/my-skills.git ~/.agents/skills
cd ~/.agents/skills
./install-skills.sh
```

Default install:

1. Symlinks every vault skill into each agent's skills folder (`npx skills add . -s '*' -g`)
2. Installs / registers [`graphify`](https://github.com/safishamsi/graphify)

**gstack** and **career-ops are optional** and are **skipped by default**. Opt in with `--extras`:

```bash
./install-skills.sh --extras gstack          # Garry Tan's gstack workflow
./install-skills.sh --extras career          # career-ops workspace
./install-skills.sh --extras gstack career   # both
./install-skills.sh --extras all             # both
./install-skills.sh --extras=gstack,career   # comma form also works
./install-skills.sh --help                   # full flag list
```

### Optional extras

#### career (`--extras career`)

Initializes the complete [`santifer/career-ops`](https://github.com/santifer/career-ops)
workspace at `$HOME/career-ops` and uses its native updater on later runs.

| Env | Effect |
|-----|--------|
| `CAREER_OPS_DIR=/path/to/workspace` | Change workspace location |
| `CAREER_OPS_SKIP=1` | Force-skip even with `--extras career` |
| `CAREER_OPS_AUTO_UPDATE=0` | Freeze an existing checkout (no auto-update) |

#### gstack (`--extras gstack`)

Pins and runs [garrytan/gstack](https://github.com/garrytan/gstack) with `--prefix`
skill names (`/gstack-qa`, `/gstack-ship`, …) so it does not clobber this vault's
`/qa`, `/review`, `/ship`, etc.

| Env | Effect |
|-----|--------|
| `GSTACK_SKIP=1` | Force-skip even with `--extras gstack` |
| `GSTACK_SKIP_BUN=1` | Skip bun install (browser skills disabled; methodology skills still work) |
| `GSTACK_REF=<ref>` | Pin to a git ref (default is a known-good commit) |

## Navigation

- **[index.md](index.md)** — start here: all skills grouped into 24 domains, plus an A–Z list.
- **[skills.base](skills.base)** — filterable / sortable table (by domain, status, rating).
- **[recipes/](recipes/index.md)** — goal-oriented workflows that chain skills together.
- **[maps/](maps)** — one map note per domain, with cross-links between domains.
- **[Scientific Expert Profiles](maps/scientific-expert-profiles.md)** — browse the
  discipline index and its per-discipline maps; each lists primary experts first,
  then cross-disciplinary experts, with bridges to broader capability maps.

Each skill has a wrapper note (e.g. `scanpy.md`) at the vault root that links to its
source `SKILL.md`, lists related skills, and holds your personal notes / status / aliases.
The original `*/SKILL.md` folders are never modified, so the skills CLI can manage them
remotely.

## Regenerating the navigation layer

After adding or removing skills, rebuild the wrappers, maps, and index:

```bash
python3 .skill-vault/build.py
```

Your edits are preserved: the `## Notes` section of each wrapper and any `status`,
`rating`, or `aliases` you set in frontmatter survive a rebuild.

> [!note] Keeping the navigation layer consistent
> The wrappers, maps, and `index.md` are **generated** from the skills on disk, so they
> drift whenever skills are added, removed, or recategorized. Re-run `build.py` (and commit
> its output) as part of any change that touches the skill set — treat a dirty diff after a
> rebuild as a signal that the committed navigation layer is stale. Domain membership is
> currently driven by the hardcoded `CATEGORIES` list in `build.py`; new skills that aren't
> listed there surface under **Uncategorized** (and a `WARNING: not categorized` line), so
> check that output after adding skills. (A future improvement is to derive the domain from
> each `SKILL.md`'s frontmatter, as the expert-persona importer already does.)
>
> `skill-lock.json` is **not** a full manifest — it records only skills installed from a
> remote source (via the skills CLI); locally-authored skills have no lock entry. Don't read
> a missing lock entry as corruption.

Flags:

- `--prune` — delete root wrapper notes whose skill folder no longer exists (only
  touches generated wrappers; hand-written root notes without a `source:` line are kept).
- `--force-aliases` — re-seed aliases from scratch (don't use after curating aliases).
- `--graph` — rewrite the graph filter + per-domain color groups in
  `.obsidian/graph.json`. **Run this with the Graph view CLOSED**, then open it.

The Obsidian graph is filtered (in `.obsidian/graph.json`) to show only the navigation
layer — wrapper, map, recipe, and index notes — so raw files inside skill folders
(`SKILL.md`, `references/*`, scripts) don't appear as isolated nodes, and each domain gets
its own color. To see everything again, clear the search box in Graph view's filter; to
also show each `SKILL.md`, add `OR file:SKILL.md` to that search.

> Note: Obsidian owns `graph.json` while the Graph view is open and re-saves it from
> memory, which can wipe externally-written color groups. If the colors disappear, close
> the Graph view, run `python3 .skill-vault/build.py --graph`, then reopen it. (`build.py`
> without `--graph` never touches `graph.json`.)
