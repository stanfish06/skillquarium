---
name: pufferlib-v3
description: PufferLib 3.x reinforcement learning workflows for the Jun 2025 API generation. Use when working with pufferlib>=3.0,<4.0, the puffer CLI, pufferlib.pufferl training helpers, Ocean environments, PPO/PufferRL training, distributed torchrun runs, custom policies, vectorization, Gymnasium/PettingZoo wrappers, or migration from deprecated v1/v2 PufferLib code.
---

# PufferLib v3

Use this skill for **PufferLib 3.x** (`pufferlib>=3.0,<4.0`). PufferLib 3.0 was released on PyPI on **June 23, 2025**. The public v3 docs emphasize the `puffer` CLI, `pufferlib.pufferl`, Ocean environments, configurable vectorization, and PPO/PufferRL training.

> [!IMPORTANT]
> Do **not** use the deprecated v1 top-level import `from pufferlib import PuffeRL`. In v3 examples, import the training module with `from pufferlib import pufferl`, then construct `pufferl.PuffeRL(...)` or use the `puffer train/eval/sweep` CLI.

## Version Selection

- Prefer `pufferlib-v3` for `pufferlib>=3.0,<4.0`, the June 2025 PyPI release line, and docs that show `pufferl.load_config`, `pufferl.load_env`, or `pufferl.load_policy`.
- Prefer `pufferlib-v2` only for code pinned to `pufferlib>=2.0,<3.0` or reproducing the 1M SPS Ocean release.
- Prefer the legacy `pufferlib` skill only for `pufferlib==1.0.0`.
- If a project tracks the 2026 `4.0` branch or `puffer.ai/docs.html`, inspect upstream first; do not assume v3 signatures.

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install "pufferlib>=3.0,<4.0"
```

For CUDA/native builds, use the project's lockfile or upstream PufferTank setup. PufferLib uses C/CUDA extensions for fast training paths, so mismatched PyTorch/CUDA/build isolation can produce import or build errors.

## Fast CLI Workflow

Use the CLI first when working with built-in environments:

```bash
puffer train ENV_NAME --help
puffer train puffer_breakout
puffer eval puffer_breakout --help
puffer sweep puffer_breakout --help
```

Common option namespaces are `train`, `env`, `vec`, `policy`, and sweep-related groups. Prefer `--help` in the active environment because exact options can vary by installed version and environment config.

## Python Training Workflow

Use this v3 shape for programmatic training:

```python
import pufferlib.ocean
import pufferlib.vector
from pufferlib import pufferl


def train(env_name='puffer_breakout'):
    args = pufferl.load_config(env_name)
    args['train']['total_timesteps'] = 10_000_000
    args['train']['learning_rate'] = 0.001
    args['vec']['num_workers'] = 4

    vecenv = pufferl.load_env(env_name, args)
    policy = pufferl.load_policy(args, vecenv, env_name)
    trainer = pufferl.PuffeRL(args['train'], vecenv, policy)

    while trainer.epoch < trainer.total_epochs:
        trainer.evaluate()
        logs = trainer.train()
        if logs:
            print(logs)

    trainer.print_dashboard()
    trainer.close()


if __name__ == '__main__':
    train()
```

Adjust the config dictionary before constructing the environment/policy/trainer. Keep environment-specific defaults from `load_config` unless you know why to override them.

## Custom Policy Pattern

Policies are PyTorch modules. For non-recurrent discrete-action policies, implement `forward(observations, state=None)` and return `(logits, values)`:

```python
import torch
import pufferlib.pytorch


class Policy(torch.nn.Module):
    def __init__(self, env):
        super().__init__()
        obs_size = env.single_observation_space.shape[0]
        action_size = env.single_action_space.n
        self.encoder = torch.nn.Sequential(
            pufferlib.pytorch.layer_init(torch.nn.Linear(obs_size, 128)),
            torch.nn.ReLU(),
            pufferlib.pytorch.layer_init(torch.nn.Linear(128, 128)),
            torch.nn.ReLU(),
        )
        self.actor = pufferlib.pytorch.layer_init(torch.nn.Linear(128, action_size), std=0.01)
        self.critic = pufferlib.pytorch.layer_init(torch.nn.Linear(128, 1), std=1.0)

    def forward(self, observations, state=None):
        hidden = self.encoder(observations)
        return self.actor(hidden), self.critic(hidden)

    def forward_eval(self, observations, state=None):
        return self.forward(observations, state)
```

For recurrent policies, preserve the `state` argument and follow repository examples for LSTM hidden-state keys. Do not silently drop masks, done flags, or environment IDs if the trainer passes them.

## Vectorization Workflow

```python
import gymnasium
import pufferlib.emulation
import pufferlib.vector


def make_env():
    env = gymnasium.make('CartPole-v1')
    return pufferlib.emulation.GymnasiumPufferEnv(env)

vecenv = pufferlib.vector.make(
    make_env,
    num_envs=8,
    num_workers=4,
    batch_size=2,
    backend=pufferlib.vector.Multiprocessing,
)
```

Guidance:

- Use `pufferlib.vector.Serial` for debugging and `pufferlib.vector.Multiprocessing` for throughput.
- Keep `num_envs`, `num_workers`, and `batch_size` compatible with the installed version's divisibility rules.
- Prefer native Ocean environments for maximum throughput; use Gymnasium/PettingZoo wrappers for compatibility and migration.
- Validate reset/step shapes in serial mode before multiprocessing.

## Distributed Training

For multi-GPU v3 runs, use PyTorch distributed launch patterns only after a single-process run works:

```bash
torchrun --standalone --nnodes=1 --nproc-per-node=NUM_GPUS -m pufferlib.pufferl train ENV_NAME
```

Check that checkpoints/log directories are rank-safe and that only rank 0 writes user-facing artifacts unless upstream examples do otherwise.

## Migration from v1/v2

- Replace `from pufferlib import PuffeRL` with `from pufferlib import pufferl`.
- Replace hand-rolled config objects with `pufferl.load_config(env_name)` where possible.
- Replace old environment factory code with `pufferl.load_env(...)` for built-ins, or `pufferlib.vector.make(...)` for custom factories.
- Ensure policies accept `state=None` and return logits plus values.
- Re-run CLI `--help` after upgrades; config namespaces and option names are version-sensitive.

## Debugging Checklist

- **Trainer import fails**: verify package version and import from `pufferlib import pufferl`.
- **C/CUDA extension import fails**: check PyTorch/CUDA compatibility and try the upstream container or install instructions for non-default PyTorch.
- **Multiprocessing hangs**: reproduce with `Serial`, then one worker, then scale up.
- **Action space errors**: inspect `vecenv.single_action_space`; continuous and structured action support can require policy/output changes.
- **Poor learning despite high SPS**: sweep learning rate first, then rollout horizon/batch size/minibatch size, entropy coefficient, gamma, and lambda.

## Sources to Check When Updating

- PyPI release history for exact 3.x release dates.
- PufferLib v3 Mintlify docs for CLI, quickstart, models, vectorization, and distributed training.
- Current upstream `puffer.ai/docs.html` if the project is not pinned; that site may describe newer 4.x behavior.
