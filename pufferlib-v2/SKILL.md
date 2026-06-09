---
name: pufferlib-v2
description: PufferLib 2.x reinforcement learning workflows for the Dec 2024 API generation. Use when working with pufferlib>=2.0,<3.0, Puffer Ocean C environments, native PufferEnv/VecEnv-style vectorization, Gymnasium/PettingZoo compatibility wrappers, asynchronous sampling, or v2 training/evaluation migration from the deprecated v1 PuffeRL top-level API.
---

# PufferLib v2

Use this skill for codebases pinned to **PufferLib 2.x** (`pufferlib>=2.0,<3.0`). PufferLib 2.0 was released on PyPI on **December 8, 2024** and introduced the Ocean/native-environment generation described by PufferAI as the 1M SPS release.

> [!IMPORTANT]
> This is not the v1 API. Do **not** write `from pufferlib import PuffeRL`; import the training module with `from pufferlib import pufferl` or use the `puffer` CLI. If the repository already uses `trainer.evaluate()`, `trainer.train()`, or `trainer.mean_and_log()`, inspect imports and pinning before editing because that pattern may be v1 or early-v2 code.

## Version Selection

- Prefer `pufferlib-v2` only for projects pinned to `pufferlib>=2.0,<3.0`, reproducing 2024/early-2025 experiments, or maintaining PufferLib 2.x environments.
- Prefer `pufferlib-v3` for `pufferlib>=3.0,<4.0` projects or when the code uses newer `pufferlib.pufferl` config helpers.
- Prefer the legacy `pufferlib` skill only for `pufferlib==1.0.0` code.

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install "pufferlib>=2.0,<3.0"
```

For environments with native graphics, Atari, NetHack, Procgen, Neural MMO, or CUDA-sensitive dependencies, prefer the upstream PufferTank container or the repository's pinned environment. Keep Python, PyTorch, CUDA, Gymnasium, and PettingZoo versions synchronized with the project lockfile.

## Primary Workflow

1. Confirm the version:
   ```bash
   python - <<'PY'
   import pufferlib, importlib.metadata
   print(importlib.metadata.version('pufferlib'))
   print(pufferlib.__file__)
   PY
   ```
2. Prefer CLI training for supported Ocean/built-in environments:
   ```bash
   puffer train ENV_NAME --help
   puffer train ENV_NAME
   puffer eval ENV_NAME --help
   ```
3. For Python training, prefer the module-level `pufferl` API and local examples in the target repository over the old top-level `PuffeRL` import.
4. Keep vectorized environment settings explicit: number of workers, environments per worker / environment count, batch size, backend, and async/sync mode.
5. Validate with a tiny run before launching a long experiment.

## Native Environment and Vectorization Guidance

PufferLib 2.x centers on high-throughput simulation:

- Use native PufferEnv/Ocean environments when performance matters. Native envs can write observations directly into buffers used by vectorization/training.
- Keep Gymnasium/PettingZoo support as a compatibility layer. Wrap existing environments rather than rewriting them first.
- Use a VecEnv-style interface by default. Async operation extends the synchronous step/reset workflow, so implement synchronous logic first, then add send/recv-style async only if needed.
- Start with a conservative worker count. Increase workers/envs per worker only after profiling CPU utilization and policy-forward time.

## Training Pattern

Use this shape for v2 maintenance work; adapt names from the installed package and repository examples rather than assuming v1 signatures:

```python
from pufferlib import pufferl

# Prefer repository-provided config/env/policy helpers when available.
config = load_or_create_config()
vecenv = make_vectorized_env(config)
policy = make_policy(vecenv, config)

trainer = pufferl.PuffeRL(config, vecenv, policy)
while not done_training(trainer, config):
    trainer.evaluate()
    logs = trainer.train()
    if logs:
        handle_logs(logs)

checkpoint = trainer.close()
```

When migrating old v1 code:

- Replace `from pufferlib import PuffeRL` with `from pufferlib import pufferl`.
- Replace `pufferlib.make(...)` calls with the v2 vectorization/environment construction used by the project.
- Ensure policies accept the state argument expected by the trainer when recurrent state or async environment metadata is enabled.
- Treat `mean_and_log()` as trainer-internal unless local examples call it directly.

## Environment Development Checklist

- Define observation/action spaces before reset/step data are consumed.
- Return consistent Gymnasium-style `obs, reward, terminated, truncated, info` data in wrappers, or the native PufferEnv equivalent in native envs.
- For multi-agent envs, keep agent ordering stable and document how dead/missing agents are padded or masked.
- Avoid per-step allocation in performance-critical environments. Allocate buffers at initialization and write in place.
- Add a smoke test that resets, steps random actions for at least 100 transitions, and checks shapes/dtypes.

## Performance Checklist

- Profile environment step time separately from policy forward/backward time.
- Use async vectorization when policy inference and environment stepping can overlap.
- Keep observation copies to a minimum; prefer native buffers for Ocean/C environments.
- Tune `num_workers`, env count, rollout horizon, batch size, and minibatch size together.
- Compare SPS after warmup, not during first-epoch compilation/build overhead.

## Common Failure Modes

- **ImportError for `PuffeRL`**: old v1 import; use `from pufferlib import pufferl`.
- **Shape mismatch on first batch**: wrapper spaces do not match reset/step output; print `single_observation_space`, `single_action_space`, and first observation dtype/shape.
- **Hanging multiprocessing run**: test the same env with a serial backend, then reduce workers to one and re-enable multiprocessing.
- **Low SPS with fast native env**: check policy forward time, Python callbacks/logging, info payload size, and whether async mode is enabled.

## Sources to Check When Updating

- PyPI release history for exact 2.x versions.
- PufferAI blog post “PufferLib 2.0: Reinforcement Learning at 1,000,000 Steps/Second”.
- The target repository's lockfile and training examples; v2 projects often carried local helper wrappers.
