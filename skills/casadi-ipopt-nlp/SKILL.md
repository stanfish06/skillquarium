---
name: casadi-ipopt-nlp
description: "Nonlinear optimization with CasADi and IPOPT. Use when building and solving NLP problems: SX/MX symbolic variables, nonlinear constraints, the nlpsol and Opti interfaces, IPOPT options, multi-start initialization with solver-status checks, and extracting solutions. An appendix covers power-systems modeling patterns (per-unit scaling, bus ID mapping)."
---

# CasADi + IPOPT for Nonlinear Programming

CasADi is a symbolic framework for nonlinear optimization. IPOPT is an interior-point solver for large-scale NLP.

## Installation

```bash
pip install casadi   # the PyPI wheels include IPOPT; pin versions in your own lockfile
```

If importing the IPOPT plugin fails on a minimal Linux image with a missing `libgfortran` error, install the Fortran runtime (e.g. `apt-get install libgfortran5` on Debian/Ubuntu).

## Building an NLP

### 1. Decision variables

```python
import casadi as ca

n_bus, n_gen = 100, 20
Vm = ca.MX.sym("Vm", n_bus)   # Voltage magnitudes
Va = ca.MX.sym("Va", n_bus)   # Voltage angles (radians)
Pg = ca.MX.sym("Pg", n_gen)   # Real power
Qg = ca.MX.sym("Qg", n_gen)   # Reactive power

# Stack into a single vector for the solver
x = ca.vertcat(Vm, Va, Pg, Qg)
```

**SX vs MX.** `ca.SX` expands every operation into scalar nodes and evaluates fastest; prefer it for models built from many scalar expressions and loops, like the per-element objective and constraint loops below. `ca.MX` keeps matrix-valued operations as single nodes; use it for large matrix-valued graphs or when the model calls other `Function` objects that cannot be expanded to SX. Do not mix SX and MX symbols in one expression. An MX problem can be converted with the solver option `"expand": True`.

### 2. Objective function

Build symbolic expression:

```python
# Quadratic cost: sum of c2*P^2 + c1*P + c0
obj = ca.MX(0)
for k in range(n_gen):
    obj += c2[k] * Pg[k]**2 + c1[k] * Pg[k] + c0[k]
```

### 3. Constraints

Collect constraints in lists with bounds:

```python
g_expr = []  # Constraint expressions
lbg = []     # Lower bounds
ubg = []     # Upper bounds

# Equality constraint: g(x) = 0
g_expr.append(some_expression)
lbg.append(0.0)
ubg.append(0.0)

# Inequality constraint: g(x) <= limit
g_expr.append(another_expression)
lbg.append(-ca.inf)
ubg.append(limit)

# Two-sided: lo <= g(x) <= hi
g_expr.append(bounded_expression)
lbg.append(lo)
ubg.append(hi)

g = ca.vertcat(*g_expr)
```

### 4. Variable bounds

```python
# Stack bounds matching variable order
lbx = np.concatenate([Vm_min, Va_min, Pg_min, Qg_min]).tolist()
ubx = np.concatenate([Vm_max, Va_max, Pg_max, Qg_max]).tolist()
```

### 5. Create and call solver

```python
nlp = {"x": x, "f": obj, "g": g}
opts = {
    "ipopt.print_level": 0,
    "ipopt.max_iter": 2000,
    "ipopt.tol": 1e-7,
    "ipopt.acceptable_tol": 1e-5,
    "ipopt.mu_strategy": "adaptive",
    "print_time": False,
}
solver = ca.nlpsol("solver", "ipopt", nlp, opts)

sol = solver(x0=x0, lbx=lbx, ubx=ubx, lbg=lbg, ubg=ubg)
x_opt = np.array(sol["x"]).flatten()
obj_val = float(sol["f"])
```

## IPOPT options (tuning guide)

| Option | Default | Recommendation | Notes |
|--------|---------|----------------|-------|
| `tol` | 1e-8 | 1e-7 | Convergence tolerance |
| `acceptable_tol` | 1e-6 | 1e-5 | Fallback if tol not reached |
| `max_iter` | 3000 | 2000 | Increase for hard problems |
| `mu_strategy` | monotone | adaptive | Better for nonconvex |
| `print_level` | 5 | 0 | Quiet output |

## Initialization matters

Nonlinear solvers are sensitive to starting points. Use multiple initializations, and only compare candidates that actually converged. `nlpsol`'s `error_on_fail` option defaults to `False`, so an infeasible or iteration-limited solve returns normally with a meaningless objective. Check `solver.stats()` after every call, or create the solver with `"error_on_fail": True` in `opts` and catch the `RuntimeError`:

```python
initializations = [x0_from_data, x0_flat_start]
best_sol = None

for x0 in initializations:
    sol = solver(x0=x0, lbx=lbx, ubx=ubx, lbg=lbg, ubg=ubg)
    stats = solver.stats()
    # error_on_fail defaults to False: failed solves do not raise
    if not stats["success"]:
        print(f"rejected start: {stats['return_status']}")
        continue
    if best_sol is None or float(sol["f"]) < float(best_sol["f"]):
        best_sol = sol

if best_sol is None:
    raise RuntimeError("Solver failed from all initializations")
sol = best_sol  # extract from the selected candidate, not the last solve
```

Inspect `stats["return_status"]` (e.g. `Solve_Succeeded` vs `Solved_To_Acceptable_Level`) if you need to treat acceptable-level termination differently.

**Good initialization strategies:**
- Data-derived: Use values from input data, clipped to bounds
- Flat start: Nominal values (e.g., Vm=1.0, Va=0.0)
- Always enforce known constraints in initial point (e.g., reference angle = 0)

## Extracting solutions

```python
x_opt = np.array(sol["x"]).flatten()

# Unpack by slicing (must match variable order)
Vm_sol = x_opt[:n_bus]
Va_sol = x_opt[n_bus:2*n_bus]
Pg_sol = x_opt[2*n_bus:2*n_bus+n_gen]
Qg_sol = x_opt[2*n_bus+n_gen:]
```

## Opti interface

`ca.Opti()` builds the same NLP with less bookkeeping: it stacks variables and constraints for you and raises if IPOPT does not succeed.

```python
import casadi as ca

opti = ca.Opti()
x = opti.variable(2)
opti.minimize((1 - x[0]) ** 2 + 100 * (x[1] - x[0] ** 2) ** 2)
opti.subject_to(x[0] ** 2 + x[1] ** 2 <= 2)
opti.subject_to(opti.bounded(-1.5, x, 1.5))
opti.set_initial(x, [0.5, 0.5])

# Plugin options first, then IPOPT options (no "ipopt." prefix)
opti.solver("ipopt", {"print_time": False, "expand": True}, {"print_level": 0, "tol": 1e-8})

try:
    sol = opti.solve()
    x_opt = sol.value(x)
    print(sol.stats()["return_status"])
except RuntimeError:
    # Inspect the last iterate and the violated constraints
    print(opti.debug.value(x))
    opti.debug.show_infeasibilities()
    raise
```

## Appendix: power systems patterns

### Per-unit scaling

Work in per-unit internally, convert for output:

```python
baseMVA = 100.0
Pg_pu = Pg_MW / baseMVA      # Input conversion
Pg_MW = Pg_pu * baseMVA      # Output conversion
```

Cost functions often expect MW, not per-unit - check the formulation.

### Bus ID mapping

Power system bus numbers may not be contiguous:

```python
bus_id_to_idx = {int(bus[i, 0]): i for i in range(n_bus)}
gen_bus_idx = bus_id_to_idx[int(gen_row[0])]
```

### Aggregating per-bus quantities

```python
Pg_bus = [ca.MX(0) for _ in range(n_bus)]
for k in range(n_gen):
    bus_idx = gen_bus_idx[k]
    Pg_bus[bus_idx] += Pg[k]
```

## Common failure modes

- **Infeasible**: Check bound consistency, constraint signs, unit conversions
- **Slow convergence**: Try different initialization, relax tolerances temporarily
- **Wrong tap handling**: MATPOWER uses `tap=0` to mean 1.0, not zero
- **Angle units**: Data often in degrees, solver needs radians
- **Shunt signs**: Check convention for Gs (conductance) vs Bs (susceptance)
- **Over-rounding outputs**: Keep high precision (≥6 decimals) in results
