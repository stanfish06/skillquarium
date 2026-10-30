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
  repository root). Local overrides in `.skill-vault/data/local-overrides.json`
  (`*/common-sources-link-*`, `lean-search-discovery/common-index-link-tools`) point them into
  this folder.

This folder has no `.skill-lock.json` entry, so `./skillquarium update` does not refresh it. When
`drift` shows the 12 skills behind upstream, re-copy these files from the new commit.
