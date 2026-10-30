# lean-autoformalization-common

Collection-level license and attribution files for the 12 skills from
[scottnarmstrong/LeanAutoformalizationSkills](https://github.com/scottnarmstrong/LeanAutoformalizationSkills)
(`build-proof-dependency-graph`, `lean-elaboration`, `lean-elaboration-test`, `lean-learnings`,
`lean-naming-style`, `lean-orchestrator`, `lean-project-architecture`, `lean-proof-patterns`,
`lean-public-release`, `lean-search-discovery`, `lean-statement-audit`, `lean-workflow`).
This folder is not a skill.

Copied from upstream commit `1837b95b3d5a9fd8d311367603902ad7fe261adf`:

- `LICENSE`: CC BY 4.0, the collection's license.
- `THIRD_PARTY_NOTICES.md` and `LICENSES/Apache-2.0.txt`: notices for material adapted from
  `cameronfreer/lean4-skills` (MIT) and `leanprover/skills` (Apache-2.0).
- `SOURCES.md`, `PROVENANCE.md`, `INDEX.md`: attribution map, adaptation record, skill index.

Changes made in this vault:

- `INDEX.md`: skill links changed from `skills/<name>/SKILL.md` to `../<name>/SKILL.md`, and the
  `README.md` link now points to the upstream README at the pinned commit.
- Skill reference files linked `../../../SOURCES.md` and `../../../INDEX.md` (the upstream
  repository root). Local overrides now point them to copies inside each installed skill.
  Cross-skill reference links point to the pinned upstream revision so single-skill installs
  do not depend on sibling folders.
- Every imported skill includes `LICENSE`, `THIRD_PARTY_NOTICES.md`, `LICENSES/Apache-2.0.txt`,
  `SOURCES.md`, `PROVENANCE.md`, and `INDEX.md`. Each index links its own entry locally and other
  entries to the pinned upstream revision. Each provenance file records the local adaptation.
- Reviewed script and documentation corrections are recorded as exact replacements in
  `.skill-vault/data/local-overrides.json`.

`manifest.json` pins the shared resource hashes, upstream revision, and all 12 upstream skill
folder hashes. `./skillquarium overrides` checks those pins and restores the per-skill copies after
an upstream reinstall. `--check` reports missing or changed copies without writing.

When a skill's upstream folder hash changes, the attribution pin becomes stale. The update CLI
stops at overrides; the update workflow quarantines the affected skill at its previous folder and
lock entry before committing other updates. Refresh the shared files and manifest from the same
reviewed upstream revision before accepting that collection update. Recompute the shared SHA-256
hashes and copy the new skill-folder hashes from the matching lock entries, then run
`./skillquarium overrides` and `./skillquarium overrides --check`.
