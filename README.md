A collection of AI agent skills, organized as an Obsidian vault for easier human navigation.

- managed by vercel's skills
- place at `~/.agents/skills`

## Navigation

- **[index.md](index.md)** — start here: all skills grouped into 18 domains, plus an A–Z list.
- **[skills.base](skills.base)** — filterable / sortable table (by domain, status, rating).
- **[recipes/](recipes/index.md)** — goal-oriented workflows that chain skills together.
- **[maps/](maps)** — one map note per domain, with cross-links between domains.

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
`rating`, or `aliases` you set in frontmatter survive a rebuild. To re-seed aliases
from scratch (before you have curated any), run `python3 .skill-vault/build.py --force-aliases`.
