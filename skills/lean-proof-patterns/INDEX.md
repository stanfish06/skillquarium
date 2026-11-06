# Skill index

All editable skill sources live under `skills/`. Each directory is a complete
shared skill for Codex and Claude Code; `agents/openai.yaml` supplies Codex UI
metadata. Supporting Python files, tests, references, and assets are retained.

| Skill | Entry point |
| --- | --- |
| `lean-workflow` | [Workflow router](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-workflow/SKILL.md) |
| `lean-project-architecture` | [Project architecture](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-project-architecture/SKILL.md) |
| `build-proof-dependency-graph` | [Source dependency graph](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/build-proof-dependency-graph/SKILL.md) |
| `lean-orchestrator` | [Proof orchestration](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-orchestrator/SKILL.md) |
| `lean-statement-audit` | [Statement and proof audit](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-statement-audit/SKILL.md) |
| `lean-search-discovery` | [Mathlib discovery](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-search-discovery/SKILL.md) |
| `lean-proof-patterns` | [Proof patterns](SKILL.md) |
| `lean-naming-style` | [Naming and style](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-naming-style/SKILL.md) |
| `lean-learnings` | [Analysis and elaboration lessons](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-learnings/SKILL.md) |
| `lean-elaboration` | [Elaboration repair](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-elaboration/SKILL.md) |
| `lean-elaboration-test` | [Performance reporting](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-elaboration-test/SKILL.md) |
| `lean-public-release` | [Formalization release](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/skills/lean-public-release/SKILL.md) |

Begin with `lean-workflow` when you need routing. Use narrow proof/search/style
skills directly for local tasks. The graph and audit workflow is appropriate
for source-facing formalizations that need exact mathematical correspondence.

See [README.md](https://github.com/scottnarmstrong/LeanAutoformalizationSkills/blob/1837b95b3d5a9fd8d311367603902ad7fe261adf/README.md) for installation and examples, and
[SOURCES.md](SOURCES.md) for public-source attribution.
