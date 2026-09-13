# Skill eval suite

Generates code with and without a skill in the system prompt, gates it, scores traits, benchmarks.

```bash
./run-eval.sh selftest     # offline: fixtures, config ids, reference solutions through every gate
./run-eval.sh              # smoke: 1 model, k=3
./run-eval.sh full         # 4 models, k=5
./run-eval.sh replay       # re-score the last run offline
./run-eval.sh report [id]
./run-eval.sh runs
```

Results: `runs/<id>/report.md`. Pairs and models: `src/config.ts`. Skills under test: `skills/<id>/skill.ts`. Tasks: `tasks/<id>/`. Language gates and benches: `bench/`.
