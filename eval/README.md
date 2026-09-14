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
