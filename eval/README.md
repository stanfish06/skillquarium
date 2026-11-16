# Skill eval suite

Generates code with and without a skill in the system prompt, gates it, scores traits, benchmarks.

```bash
./skillquarium eval selftest     # offline: fixtures, config ids, reference solutions through every gate
./skillquarium eval              # run
./skillquarium eval replay       # re-score the last run offline
./skillquarium eval report [id]
./skillquarium eval runs
```

`runs/` is gitignored; a round worth keeping is copied into `archive/`.

## Tier 1 static checks

`./skillquarium eval tier1` runs [SkillEvaluator](https://github.com/NVIDIA/SkillEvaluator)
Tier 1 (`skillevaluator==0.9.0 tier1 --no-llm`) on skills under `skills/`. It needs uv, but
not this suite's mise toolchain or an API key. The evaluator fetches its pinned SkillSpector
and Gitleaks on first use.

```bash
./skillquarium eval tier1 opensrc scanpy          # named skills
./skillquarium eval tier1 --changed origin/master # skills changed since the merge base
./skillquarium eval tier1 --all --jobs 8          # every skill, about 17 s each per job
```

Each run writes full JSON/HTML reports to `eval/tier1/reports/<timestamp>/` (gitignored) and
merges one line per skill into `eval/tier1/results.jsonl`, which the TUI's Tier 1 column reads.
A line records the skill's git tree hash, so the TUI marks a result stale once the skill
changes. Pass `--no-record` to leave the results file alone.

The checks are advisory. A failing skill exits 0, and only an evaluator that writes no
report exits 1. `.github/workflows/skill-tier1.yml` runs the same command:

- On pull requests it scans changed skills and writes the summary table to the job summary.
  Reports go to the `tier1-reports` artifact.
- Run it manually from the Actions tab to sweep every skill in 16 shards. The `record` job
  merges the shards with `--merge` and commits `results.jsonl` to master.
