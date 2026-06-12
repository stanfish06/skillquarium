---
name: optuna
description: Hyperparameter optimization (HPO) for ML models using Optuna. Use when tuning learning rate, regularization, architecture choices, or any numeric/categorical hyperparameter. Covers create_study/optimize quickstart, sampler selection (TPE, CMA-ES, grid, random, NSGA-II), pruners for early stopping (MedianPruner, HyperbandPruner), distributed search with RDBStorage, integrations with PyTorch Lightning and scikit-learn, and built-in visualization.
license: MIT
allowed-tools: Read Write Edit Bash
compatibility: Requires Python 3.9+ and optuna 4.0+. Optional extras — optuna-integration for framework callbacks (PyTorch Lightning, XGBoost, LightGBM, scikit-learn). Plotly or matplotlib for visualization.
metadata: {"version": "1.0", "skill-author": "community"}
---

# Optuna

## Overview

Optuna is a define-by-run hyperparameter optimization (HPO) framework from Preferred Networks. Unlike grid/random search, Optuna uses Bayesian samplers that learn which regions of the search space are promising and concentrate evaluations there. It also supports multi-objective optimization, distributed parallel search, and early stopping via pruners.

Use this skill when you need to tune any ML model's hyperparameters — it is framework-agnostic and integrates with PyTorch, PyTorch Lightning, TensorFlow, scikit-learn, XGBoost, LightGBM, and Hugging Face Transformers.

## Installation

Tested against **optuna 4.x** (latest 4.9.0, June 2026). Requires **optuna 4.0+** and **Python 3.9+** (the skill uses 4.x APIs such as `PatientPruner` and `JournalStorage`).

```bash
# Core install
uv pip install optuna

# Framework integrations (PyTorch Lightning, sklearn, XGBoost, LightGBM, HF)
uv pip install optuna-integration

# CMA-ES sampler backend (CmaEsSampler needs the separate `cmaes` package)
uv pip install cmaes

# Visualization backend (choose one)
uv pip install plotly          # recommended — interactive HTML plots
uv pip install matplotlib      # fallback static plots

# Distributed search storage — Optuna has no postgres/mysql extras;
# install the DB driver directly alongside optuna
uv pip install psycopg2-binary     # PostgreSQL driver for RDBStorage
uv pip install pymysql             # MySQL/MariaDB driver for RDBStorage
```

Check version:

```python
import optuna
print(optuna.__version__)
```

## When to Use This Skill

Use Optuna when:

- You have a trained model and need to find better hyperparameters (learning rate, batch size, regularization, layer sizes, etc.)
- Grid search is too expensive (search space grows exponentially)
- You want automatic early stopping — kill bad trials mid-epoch to save GPU hours
- You need to optimize multiple competing objectives (e.g. accuracy vs. inference speed)
- You are running distributed HPO across multiple processes or machines
- You want reproducible, logged experiment records

## Quick Start

### Minimal Example

```python
import optuna

def objective(trial):
    # Suggest hyperparameters
    lr = trial.suggest_float("lr", 1e-5, 1e-1, log=True)
    n_layers = trial.suggest_int("n_layers", 1, 5)
    dropout = trial.suggest_float("dropout", 0.0, 0.5)

    # Train your model and return a metric to minimize/maximize
    val_loss = train_and_evaluate(lr=lr, n_layers=n_layers, dropout=dropout)
    return val_loss

study = optuna.create_study(direction="minimize")
study.optimize(objective, n_trials=100)

print("Best trial:", study.best_trial.params)
print("Best value:", study.best_value)
```

### Accessing Results

```python
# Best trial
trial = study.best_trial
print(f"Value: {trial.value}, Params: {trial.params}")

# All completed trials as a DataFrame
df = study.trials_dataframe()

# Top-5 trials — filter to COMPLETE trials first; pruned/failed/running
# trials have value=None and would raise TypeError when sorted against floats
import optuna
completed = [t for t in study.trials if t.state == optuna.trial.TrialState.COMPLETE]
trials = sorted(completed, key=lambda t: t.value)[:5]
for t in trials:
    print(t.number, t.value, t.params)
```

## Suggesting Hyperparameters

All `suggest_*` calls are inside the `objective(trial)` function.

```python
# Continuous (uniform in [low, high])
lr = trial.suggest_float("lr", 1e-5, 1e-1)          # uniform
lr = trial.suggest_float("lr", 1e-5, 1e-1, log=True) # log-uniform (recommended for LR)

# Integer (inclusive range)
n_layers = trial.suggest_int("n_layers", 1, 8)
n_units = trial.suggest_int("n_units", 32, 512, step=32)  # multiples of 32

# Categorical
optimizer = trial.suggest_categorical("optimizer", ["adam", "sgd", "rmsprop"])
activation = trial.suggest_categorical("activation", ["relu", "tanh", "elu"])

# Conditional parameters (only suggest if parent is chosen)
optimizer_name = trial.suggest_categorical("optimizer", ["adam", "sgd"])
if optimizer_name == "sgd":
    momentum = trial.suggest_float("momentum", 0.5, 0.99)
```

## Sampler Selection

The sampler determines how Optuna proposes next hyperparameter values. Pass it to `create_study`.

### TPE (default) — Tree-structured Parzen Estimator

Best general-purpose choice. Builds a probabilistic model of good vs. bad regions.

```python
from optuna.samplers import TPESampler

study = optuna.create_study(
    direction="minimize",
    sampler=TPESampler(seed=42, n_startup_trials=10)
)
```

### CMA-ES — Covariance Matrix Adaptation Evolution Strategy

Better for continuous search spaces where parameters are correlated. Use for ≥5 numeric parameters. Requires the separate `cmaes` package (`uv pip install cmaes`) — a plain `optuna` install raises a missing-backend error.

```python
from optuna.samplers import CmaEsSampler

study = optuna.create_study(
    direction="minimize",
    sampler=CmaEsSampler(seed=42)
)
```

### Grid Search

Exhaustively evaluates all combinations. Only feasible for tiny grids (≤hundreds of trials).

```python
from optuna.samplers import GridSampler

search_space = {
    "lr": [1e-3, 1e-4],
    "n_layers": [2, 3, 4],
}
study = optuna.create_study(sampler=GridSampler(search_space))
```

### Random Search

Useful as a baseline or when no prior knowledge is available.

```python
from optuna.samplers import RandomSampler

study = optuna.create_study(sampler=RandomSampler(seed=42))
```

### NSGA-II — Multi-Objective (Pareto Front)

Use when optimizing two or more competing metrics simultaneously (returns Pareto-optimal trials instead of a single best).

```python
from optuna.samplers import NSGAIISampler

study = optuna.create_study(
    directions=["minimize", "maximize"],  # e.g. loss ↓ and accuracy ↑
    sampler=NSGAIISampler(seed=42)
)

# Each objective returns a tuple
def objective(trial):
    ...
    return val_loss, val_accuracy

study.optimize(objective, n_trials=200)

# Access Pareto-front trials
pareto = study.best_trials
for t in pareto:
    print(t.values, t.params)
```

## Pruners — Early Stopping

Pruners stop unpromising trials early. The objective calls `trial.report()` and `trial.should_prune()` at each epoch.

### MedianPruner

Prunes a trial when its best intermediate result is **worse** than the median of previous completed trials at the same step. Optuna accounts for the study direction, so "worse" means below the median when maximizing and above it when minimizing (e.g. a `val_loss` study prunes trials whose loss is higher than the median).

```python
from optuna.pruners import MedianPruner

study = optuna.create_study(
    direction="minimize",
    pruner=MedianPruner(n_startup_trials=5, n_warmup_steps=10)
)

def objective(trial):
    for epoch in range(100):
        val_loss = train_one_epoch(...)

        trial.report(val_loss, step=epoch)
        if trial.should_prune():
            raise optuna.TrialPruned()

    return val_loss
```

### HyperbandPruner

Implements Hyperband (successive halving). More aggressive; best for expensive training runs.

```python
from optuna.pruners import HyperbandPruner

study = optuna.create_study(
    direction="minimize",
    pruner=HyperbandPruner(min_resource=3, max_resource=30, reduction_factor=3)
)
```

### PatientPruner

Prunes if no improvement for N consecutive steps. Wraps any base pruner.

```python
from optuna.pruners import PatientPruner, MedianPruner

study = optuna.create_study(
    pruner=PatientPruner(wrapped_pruner=MedianPruner(), patience=5)
)
```

## Distributed Search with RDBStorage

Store trials in a relational database so multiple worker processes (or machines) can run the same study concurrently.

### PostgreSQL

```python
import optuna

storage = optuna.storages.RDBStorage(
    url="postgresql://user:password@localhost:5432/optuna_db",
    engine_kwargs={"pool_size": 10}
)

study = optuna.create_study(
    study_name="my_experiment",
    storage=storage,
    load_if_exists=True,    # resume if study already exists
    direction="minimize",
)

# Launch multiple workers in parallel — each calls study.optimize independently
study.optimize(objective, n_trials=50)
```

### MySQL / MariaDB

```python
storage = optuna.storages.RDBStorage(
    url="mysql+pymysql://user:password@localhost:3306/optuna_db"
)
```

### Resuming a Study

```python
study = optuna.load_study(
    study_name="my_experiment",
    storage="postgresql://user:password@localhost/optuna_db"
)
print(f"Resuming with {len(study.trials)} trials already completed.")
```

### In-memory JournalStorage (lightweight multi-process)

```python
# optuna 4.x: JournalStorage is a top-level storages export, but the file
# backend lives in optuna.storages.journal (optuna.storages only keeps the
# deprecated JournalFileStorage)
from optuna.storages import JournalStorage
from optuna.storages.journal import JournalFileBackend

storage = JournalStorage(JournalFileBackend("optuna_journal.log"))
study = optuna.create_study(storage=storage, study_name="local_run")
```

## Framework Integrations

All integrations require `optuna-integration` package.

### PyTorch Lightning

```python
import pytorch_lightning as pl
from optuna_integration import PyTorchLightningPruningCallback

def objective(trial):
    lr = trial.suggest_float("lr", 1e-5, 1e-1, log=True)
    model = MyLightningModel(lr=lr)

    trainer = pl.Trainer(
        max_epochs=30,
        callbacks=[
            PyTorchLightningPruningCallback(trial, monitor="val_loss")
        ],
    )
    trainer.fit(model, train_dataloader, val_dataloader)
    return trainer.callback_metrics["val_loss"].item()

study = optuna.create_study(
    direction="minimize",
    pruner=optuna.pruners.MedianPruner()
)
study.optimize(objective, n_trials=50)
```

### scikit-learn — OptunaSearchCV

Drop-in replacement for `GridSearchCV` / `RandomizedSearchCV` that uses TPE under the hood.

```python
from optuna_integration import OptunaSearchCV
from sklearn.ensemble import RandomForestClassifier
from optuna.distributions import IntDistribution, FloatDistribution

param_distributions = {
    "n_estimators": IntDistribution(50, 500),
    "max_depth": IntDistribution(3, 15),
    "min_samples_split": IntDistribution(2, 20),
    "max_features": FloatDistribution(0.1, 1.0),
}

clf = OptunaSearchCV(
    RandomForestClassifier(random_state=42),
    param_distributions,
    n_trials=50,
    cv=5,
    scoring="f1_weighted",
    random_state=42,
)
clf.fit(X_train, y_train)

print("Best params:", clf.best_params_)
print("Best score:", clf.best_score_)
```

### XGBoost / LightGBM

```python
# XGBoost with pruning via XGBoostPruningCallback
from optuna_integration import XGBoostPruningCallback
import xgboost as xgb

def objective(trial):
    params = {
        "max_depth": trial.suggest_int("max_depth", 3, 10),
        "learning_rate": trial.suggest_float("learning_rate", 1e-3, 0.3, log=True),
        "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
    }
    model = xgb.XGBClassifier(
        **params,
        callbacks=[XGBoostPruningCallback(trial, "validation_0-logloss")],
        eval_metric="logloss",
        early_stopping_rounds=10,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    return model.best_score

study = optuna.create_study(
    direction="minimize",
    pruner=optuna.pruners.MedianPruner()
)
study.optimize(objective, n_trials=100)
```

```python
# LightGBM with pruning
from optuna_integration import LightGBMPruningCallback
import lightgbm as lgb

def objective(trial):
    params = {
        # objective/metric must be set so LightGBM emits the validation metric
        # the pruning callback and best_score lookup below request
        "objective": "binary",
        "metric": "binary_logloss",
        "num_leaves": trial.suggest_int("num_leaves", 20, 300),
        "learning_rate": trial.suggest_float("learning_rate", 1e-4, 0.3, log=True),
        "min_child_samples": trial.suggest_int("min_child_samples", 5, 100),
        "feature_fraction": trial.suggest_float("feature_fraction", 0.4, 1.0),
    }
    callbacks = [LightGBMPruningCallback(trial, "binary_logloss")]
    model = lgb.train(
        params,
        train_set,
        num_boost_round=500,
        valid_sets=[val_set],
        callbacks=callbacks,
    )
    return model.best_score["valid_0"]["binary_logloss"]
```

## Visualization

Optuna ships built-in interactive plots (Plotly). For static plots, import the parallel `optuna.visualization.matplotlib` module instead (the plot functions take no `backend_name` argument) — e.g. `from optuna.visualization.matplotlib import plot_optimization_history`.

```python
import optuna.visualization as vis

# Optimization history — see if the study is converging
fig = vis.plot_optimization_history(study)
fig.show()  # or fig.write_html("history.html")

# Parameter importances — which hyperparameters matter most
fig = vis.plot_param_importances(study)
fig.show()

# Parallel coordinate plot — view correlations between params and objective
fig = vis.plot_parallel_coordinate(study)
fig.show()

# Contour plot — 2D slice of the objective surface
fig = vis.plot_contour(study, params=["lr", "n_layers"])
fig.show()

# Slice plot — 1D marginals
fig = vis.plot_slice(study, params=["lr", "dropout"])
fig.show()

# EDF (empirical distribution function) — compare multiple studies
fig = vis.plot_edf([study1, study2], value_range=(0, 1))
fig.show()
```

## CLI

Optuna ships a CLI for managing studies stored in a database and launching the web dashboard.

```bash
# Create a new study
optuna create-study \
  --study-name my_experiment \
  --storage "postgresql://user:pass@localhost/optuna_db" \
  --direction minimize

# List all studies in a storage
optuna studies \
  --storage "postgresql://user:pass@localhost/optuna_db"

# Print best trial of a study
optuna best-trial \
  --study-name my_experiment \
  --storage "postgresql://user:pass@localhost/optuna_db"

# Dump all trials — the `trials` command has no --output/CSV; use --format
# {value,json,table,yaml} and redirect to a file
optuna trials \
  --study-name my_experiment \
  --storage "postgresql://user:pass@localhost/optuna_db" \
  --format json > trials.json
# For CSV, load the study in Python and use the DataFrame:
#   optuna.load_study(study_name=..., storage=...).trials_dataframe().to_csv("trials.csv")

# Launch the web dashboard (requires optuna-dashboard package)
pip install optuna-dashboard
optuna-dashboard "postgresql://user:pass@localhost/optuna_db"
# Opens at http://localhost:8080
```

## Common Workflows

### Standard HPO Workflow

```python
import optuna
optuna.logging.set_verbosity(optuna.logging.WARNING)  # suppress per-trial logs

def objective(trial):
    # 1. Suggest hyperparameters
    lr = trial.suggest_float("lr", 1e-5, 1e-2, log=True)
    weight_decay = trial.suggest_float("weight_decay", 1e-6, 1e-2, log=True)
    hidden_size = trial.suggest_categorical("hidden_size", [128, 256, 512])

    # 2. Build and train model — report after each epoch so the pruner can act.
    #    HyperbandPruner (like all pruners) is inert without trial.report()/
    #    trial.should_prune(); training as one opaque call would never prune.
    model = build_model(hidden_size=hidden_size)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
    for epoch in range(20):
        val_loss = train_one_epoch(model, optimizer)   # one epoch of train + validate
        trial.report(val_loss, step=epoch)
        if trial.should_prune():
            raise optuna.TrialPruned()
    return val_loss

# 3. Run study
study = optuna.create_study(
    direction="minimize",
    sampler=optuna.samplers.TPESampler(seed=42),
    pruner=optuna.pruners.HyperbandPruner(),
)
study.optimize(objective, n_trials=200, timeout=3600, n_jobs=4)

# 4. Extract best hyperparameters
best = study.best_trial
print(f"Best val_loss: {best.value:.4f}")
print("Best hyperparameters:", best.params)
```

### Multi-objective Study

```python
study = optuna.create_study(
    directions=["minimize", "minimize"],  # loss, latency
    sampler=optuna.samplers.NSGAIISampler(seed=42),
)

def objective(trial):
    n_layers = trial.suggest_int("n_layers", 1, 6)
    hidden = trial.suggest_int("hidden", 32, 512, log=True)
    model = build_model(n_layers, hidden)
    val_loss = train(model)
    latency_ms = benchmark_inference(model)
    return val_loss, latency_ms

study.optimize(objective, n_trials=300)

# Pareto-optimal solutions
for t in study.best_trials:
    print(f"loss={t.values[0]:.4f}, latency={t.values[1]:.1f}ms, params={t.params}")
```

### Parallel Search with n_jobs

```python
# Run 4 trials in parallel using threads (GIL-safe for I/O-bound training)
study.optimize(objective, n_trials=100, n_jobs=4)

# For CPU-bound training, use separate processes + shared storage instead
# Process 1:
study.optimize(objective, n_trials=50)   # writes to shared RDBStorage

# Process 2 (same command, different process):
study.optimize(objective, n_trials=50)
```

## Best Practices

### Log-scale for Learning Rates and Regularization
Always use `log=True` for parameters that span orders of magnitude:
```python
lr = trial.suggest_float("lr", 1e-5, 1e-1, log=True)       # Good
lr = trial.suggest_float("lr", 0.00001, 0.1)                # Bad — wastes budget near 0
```

### Set seed for Reproducibility
```python
sampler = optuna.samplers.TPESampler(seed=42)
study = optuna.create_study(sampler=sampler)
```

### Use Callbacks for Live Monitoring
```python
def log_callback(study, trial):
    # trial.value is None for pruned/failed trials; skip them so that
    # study.best_value (which raises ValueError until a trial COMPLETEs) is safe
    if trial.value is not None:
        print(f"Trial {trial.number}: {trial.value:.4f} | Best: {study.best_value:.4f}")

study.optimize(objective, n_trials=100, callbacks=[log_callback])
```

### Warm-start from Previous Results
```python
# Add manually known good points to steer the sampler
study.enqueue_trial({"lr": 1e-3, "n_layers": 3})
study.optimize(objective, n_trials=100)
```

### Disable Logging for Clean Output
```python
optuna.logging.set_verbosity(optuna.logging.WARNING)
```

## Troubleshooting

### TrialPruned Is Not an Error
`TrialPruned` is raised intentionally by the pruner. It is caught internally by Optuna and marks the trial as pruned — not failed. Never catch it yourself unless you re-raise it:
```python
def objective(trial):
    for epoch in range(100):
        loss = train_epoch(...)
        trial.report(loss, epoch)
        if trial.should_prune():
            raise optuna.TrialPruned()   # correct — don't catch this
    return loss
```

### Sampler Has Low n_startup_trials Exploration
If your search space is large, TPE may converge prematurely. Increase startup exploration:
```python
sampler = optuna.samplers.TPESampler(n_startup_trials=30, seed=42)
```

### Visualization Requires Plotly
```python
# If plotly is missing:
uv pip install plotly

# Alternatively use matplotlib backend:
optuna.visualization.matplotlib.plot_optimization_history(study)
```

### Storage Connection Errors in Distributed Mode
Use `heartbeat_interval` to detect crashed workers:
```python
from optuna.storages import RetryFailedTrialCallback

storage = optuna.storages.RDBStorage(
    url="postgresql://...",
    heartbeat_interval=60,   # mark stale trials as failed after 60s silence
    failed_trial_callback=RetryFailedTrialCallback(),
)
```

## Additional Resources

- Official Documentation: https://optuna.readthedocs.io/
- GitHub: https://github.com/optuna/optuna
- optuna-integration package: https://github.com/optuna/optuna-integration
- optuna-dashboard: https://github.com/optuna/optuna-dashboard
- Tutorial notebooks: https://github.com/optuna/optuna-examples
