# Skillquarium

A collection of AI agent skills, organized as an Obsidian vault for easier human navigation.

- managed by vercel's skills
- place at `~/.agents` (the repo root _is_ the skills CLI's home; skill folders live in `skills/`)

## Screenshot

<table width="100%">
  <tr>
    <th>Obsidian graph</th>
    <th>Graphifyy graph</th>
    <th>Skillquarium TUI</th>
  </tr>
  <tr>
     <td width="33%">
       <img src="./screenshot.png" width="300" alt="Obsidian graph view of the skill vault" />
     </td>
     <td width="33%">
       <img src="./graphifyy.png" width="300" alt="Graphifyy graph view of skill relationships" />
     </td>
     <td width="33%">
       <img src="./skill-toggle.png" width="300" alt="Skillquarium TUI: skill toggles and benchmark results" />
     </td>
  </tr>
</table>

## Setup

```bash
mkdir -p ~/.agents && cd ~/.agents
git init
git remote add origin git@github.com:stanfish06/skillquarium.git
git fetch origin
git checkout -f master
./install-skills.sh
```

Default install:

1. Symlinks every vault skill into each agent's skills folder (`npx skills add . -s '*' -g`)
2. Installs / registers [`graphify`](https://github.com/safishamsi/graphify)

**gstack**, **career-ops**, and **UI/UX Pro Max** are optional and are
**skipped by default**. Opt in with `--extras`:

```bash
./install-skills.sh --extras gstack          # Garry Tan's gstack workflow
./install-skills.sh --extras career          # career-ops workspace
./install-skills.sh --extras ui-ux           # UI/UX Pro Max seven-skill bundle
./install-skills.sh --extras gstack career ui-ux
./install-skills.sh --extras all             # all optional extras
./install-skills.sh --extras=gstack,ui-ux    # comma form also works
./install-skills.sh --help                   # full flag list
```

## Navigation

- **[vault/index.md](vault/index.md)** — start here: all skills grouped by domain, plus an A–Z list.
- **[vault/skills.base](vault/skills.base)** — filterable / sortable table (by domain, status, rating).
- **[vault/recipes/](vault/recipes/index.md)** — goal-oriented workflows that chain skills together.
- **[vault/maps/](vault/maps)** — one map note per domain, with cross-links between domains.
- **[Scientific Expert Profiles](vault/maps/scientific-expert-profiles.md)** — browse the
  discipline index and its per-discipline maps; each lists primary experts first,
  then cross-disciplinary experts, with bridges to broader capability maps.

### Skillquarium TUI

Run the [OpenTUI](https://github.com/anomalyco/opentui) interface from the vault root:

```bash
./skillquarium
```

The launcher requires [Bun](https://bun.sh) and installs the pinned OpenTUI dependency on
first use. It has two tabs, switched with Tab, `1`/`2`, or a click:

- **Skills** toggles model invocation.
- **Benchmarks** lists the skills under evaluation in `eval/skills/`

Keyboard controls (Skills tab):

- `/` focuses search; arrows or `J`/`K` move through results; `M` marks or unmarks the current row.
- `C` toggles Claude Code, `X` toggles Codex, and Space toggles both for all marked rows. With no marks, they affect only the current row. A mixed batch is normalized on; a fully enabled batch is normalized off.
- `F` cycles status filters; `G` cycles categories. Shift reverses either cycle.
- Ctrl-S saves all states; Ctrl-R reloads them; Ctrl-P performs the guarded pre-commit reset.
- `Q` or Esc quits when search is not focused.

The table shows four combined states:

- `enabled` — Claude Code and Codex may both invoke the skill automatically.
- `disabled` — only explicit invocation is allowed in both products.
- `mixed` — the Claude Code and Codex fields disagree; toggling makes both enabled.
- `error` — malformed metadata must be repaired before the tool will change it.

Save writes `.skill-vault/skill-toggle-state.json` . Reload reapplies both products
from that snapshot.

The tool writes `disable-model-invocation` in `SKILL.md` for Claude Code and
`policy.allow_implicit_invocation` in `agents/openai.yaml` for Codex.
This prevents skills from loading into agent's context window automatically,
but you can still invoke them manually if needed.

Scriptable commands use the same safe backend:

```bash
./skillquarium list
./skillquarium enable academic-paper atac-seq
./skillquarium enable --product claude academic-paper
./skillquarium disable --product codex atac-seq
./skillquarium disable academic-paper atac-seq
./skillquarium toggle academic-paper
./skillquarium save
./skillquarium load
./skillquarium pre-commit-reset
./skillquarium --query "single cell"
```

As of 2026-08-09, claude code and pi can reliably toggle skills and
reduce context usage, codex is not working well.
As a workaround, one can use pi as the harness for gpt models.

## Regenerating the navigation layer

After adding or removing skills, rebuild the wrappers, maps, and index:

```bash
python3 .skill-vault/build.py
```
