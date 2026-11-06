---
name: milp-solver-workflow
description: Use for formulating, solving, debugging, and validating mixed-integer linear optimization models with open-source solvers, including variable indexing, sparse constraints, linearized costs, solver limits, MIP gaps, incumbent extraction, numerical tolerances, and deterministic output reporting.
---

# MILP Solver Workflow

Use this skill for binary/integer decisions, linear constraints, and linear or piecewise-linear objectives. It is useful for time-expanded scheduling models with many repeated resource-period constraints.

This is a workflow and implementation guide, not a complete formulation for any one task.

## Workflow

1. Parse and normalize data into ordered arrays.
2. Define decision states before coding: status, transitions, continuous quantities, slacks, segments, tiers.
3. Build a deterministic variable map.
4. Add constraints family by family: bounds, linking, balance, time coupling, capacity/ramp limits, cost logic.
5. Solve with an available open-source MILP solver.
6. Extract a candidate solution, rounding binaries only if near integral.
7. Convert internal variables into the report convention.
8. Independently validate extracted arrays.
9. Recompute objective and summaries from extracted arrays.
10. Write final output only after validation passes.

## Variable Map Pattern

Use helper functions or dictionaries, not scattered index arithmetic.

```python
var_index = {}
var_lb, var_ub, var_int = [], [], []

def alloc(name, shape, lb=0.0, ub=float("inf"), integer=False):
    # next free column = number of variables allocated so far; no global counter needed
    start = len(var_lb)
    size = int(np.prod(shape))
    idx = np.arange(start, start + size).reshape(shape)
    var_index[name] = idx
    var_lb.extend([lb] * size)
    var_ub.extend([ub] * size)
    var_int.extend([int(integer)] * size)
    return idx

u = alloc("commitment", (G, T), lb=0, ub=1, integer=True)
start = alloc("startup", (G, T), lb=0, ub=1, integer=True)
dispatch = alloc("dispatch", (G, T), lb=0)
reserve = alloc("reserve", (G, T), lb=0)
```

Keep variable ownership obvious: type, resource, period, and optional segment/tier.

## Sparse Constraint Pattern

Use sparse rows for large time-expanded models:

```python
rows, cols, vals = [], [], []
row_lb, row_ub = [], []

def add_row(terms, lo, hi):
    r = len(row_lb)  # next row id = rows added so far
    for j, a in terms:
        if abs(a) > 0:
            rows.append(r)
            cols.append(int(j))
            vals.append(float(a))
    row_lb.append(float(lo))
    row_ub.append(float(hi))
```

Use equality rows for conservation/linking and upper/lower bound rows for capacity, reserve, ramping, timing, and logic.

## Sign-Safe Encoding

Write the intended inequality first, then move variable terms to the left-hand side.

```python
# Intended: x + y <= cap * u - reduction * start
# Row form: x + y - cap*u + reduction*start <= 0
add_row(
    [(x, 1.0), (y, 1.0), (u, -cap), (start, reduction)],
    lo=-INF,
    hi=0.0,
)
```

For non-obvious rows, test a tiny hand case. Example: set `u=1`, `start=1` and check the remaining capacity equals the intended startup capability; set `u=1`, `start=0` and check normal capacity returns.

## Match Model Rows To Validation

Keep a checklist linking each model constraint family to a validation check:

```text
transition linking      -> startup/shutdown match status
online capacity         -> offline zeroes and min/max output
joint reserve capacity  -> production plus reserve fits capability
ramp deliverability     -> reserve can be deployed within ramp-up
minimum durations       -> starts/stops imply required status windows
balance equations       -> demand/load/inventory conservation
cost-curve logic        -> recomputed objective matches report
```

If validation checks something not in the model, the solver may produce an invalid report. If the model has a constraint not validated after extraction, conversion bugs can slip through.

## Piecewise-Linear Costs

Identify the curve convention before modeling:

- total cost at output breakpoints;
- marginal or incremental segment cost;
- heat-rate curve;
- first point as minimum-output or no-load-like cost.

For segment variables, constrain segment quantities to their widths and sum them to the modeled production quantity. Use slopes only when the data represents total-cost breakpoints or incremental segment costs consistently.

## Open-Source Solver Use

HiGHS through SciPy is a common default when available:

```python
from scipy.optimize import milp, LinearConstraint, Bounds
from scipy.sparse import coo_array

A = coo_array((vals, (rows, cols)), shape=(len(row_lb), len(var_lb))).tocsr()
constraints = LinearConstraint(A, row_lb, row_ub)

result = milp(
    c=c,
    integrality=var_int,
    bounds=Bounds(var_lb, var_ub),
    constraints=constraints,
    options={"time_limit": 600.0, "mip_rel_gap": 0.01, "disp": False},
)

if result.x is None:
    raise RuntimeError(f"No incumbent: status={result.status}, message={result.message}")
```

Capture status, objective, incumbent values, and any reliable gap/bound. The `milp` result exposes `result.status`, `result.fun`, `result.x`, `result.mip_gap`, and `result.mip_dual_bound`; check the last two for `None`/NaN before reporting them. A time-limit status (`result.status == 1`) can be useful if a feasible incumbent exists; a failure with no incumbent is not a solution.

## Extraction And Validation

After solving:

- check binary variables are close to 0/1 before rounding;
- convert internal units/conventions to report units;
- recompute summaries from arrays;
- recompute objective from input data and extracted decisions;
- run validation that reads only input data plus extracted/report arrays;
- write any self-reported check or status fields only after validation passes.

## Debugging Infeasibility

First suspect the model encoding. Common causes:

- mixing total output with output above minimum;
- applying startup/shutdown limits to the wrong quantity;
- using the wrong `t` or `t-1` index;
- over-constraining initial minimum up/down obligations;
- enforcing post-horizon obligations when the prompt excludes them;
- treating cost curves as feasibility constraints;
- choosing bad Big-M values;
- requiring segment/tier variables when the trigger did not occur.

Debug in stages: check shapes, relax one family at a time, add diagnostic slack variables, print largest violations, and compare local validation with final requirements.

## Repair LPs And Heuristics

A fixed-commitment repair LP is useful only if it includes every feasibility family judged in the final report. Do not repair only balance and capacity while omitting transition-dependent ramp, reserve, startup, shutdown, or minimum-duration limits.

Always rerun independent validation after repair.

## Reporting Discipline

- Use deterministic ordering and plain numeric values.
- Do not include placeholder values.
- Keep feasibility separate from proof quality/MIP gap.
- Use `null`/empty gap when no reliable bound exists, if the schema allows it.
- Do not trust solver status or self-reported `"pass"` strings without validation.
