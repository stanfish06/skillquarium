# skillsbench-common

License file for the skills vendored from
[benchflow-ai/skillsbench](https://github.com/benchflow-ai/skillsbench) (Apache-2.0), upstream
commit `f860ecf02ef53412a030f8661c83d644b739ff01`. This folder is not a skill.

- `LICENSE`: the repository's Apache License 2.0. Upstream has no `NOTICE` file, and no vendored
  skill carries its own license file. `trend-analysis` declares `license: MIT` in its frontmatter.

Each vendored skill folder sits upstream at `tasks/<task>/environment/skills/<name>/`; its
`.skill-lock.json` entry records the exact path and folder tree SHA. Upstream history is a single
squashed commit, so per-skill authors are only recorded in each task's `task.md`.

Changes made in this vault: the skills are copied unmodified, and every local edit is a recorded
override in `.skill-vault/data/local-overrides.json` (source `benchflow-ai/skillsbench`). The edits
remove benchmark-specific text (task paths, grader wording, task-shaped examples) and fix technical
errors found in review. Apache-2.0 section 4(b) requires stating that files were modified: those
overrides are that statement.

This folder has no `.skill-lock.json` entry, so `./skillquarium update` does not refresh it.
