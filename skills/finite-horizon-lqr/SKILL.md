---
name: finite-horizon-lqr
description: Solve unconstrained finite-horizon discrete-time LQR by backward Riccati recursion - time-varying gain sequence, DARE terminal cost, and receding-horizon use. Problems with input or state constraints need a QP-based MPC instead.
---

# Finite-Horizon LQR (Unconstrained)

## Problem Formulation

Minimize cost over horizon N:
```
J = Σ(k=0 to N-1) [x_k'Q x_k + u_k'R u_k] + x_N' P_N x_N
subject to x_{k+1} = A x_k + B u_k   (no input or state constraints)
```

## Backward Riccati Recursion

Initialize the terminal cost P_N. A common choice is the infinite-horizon solution of the discrete algebraic Riccati equation:

```python
from scipy.linalg import solve_discrete_are

P_N = solve_discrete_are(A, B, Q, R)
```

With this P_N the recursion is already at its fixed point, so every K_k equals the infinite-horizon LQR gain. A different terminal weight (e.g. P_N = Q) gives gains that vary along the horizon.

For k = N-1 down to 0:
```python
K[k] = np.linalg.solve(R + B.T @ P[k + 1] @ B, B.T @ P[k + 1] @ A)
P[k] = Q + A.T @ P[k + 1] @ (A - B @ K[k])
```

## Forward Simulation

Starting from x_0:
```python
u[k] = -K[k] @ x[k]
x[k + 1] = A @ x[k] + B @ u[k]
```

## Python Implementation

```python
import numpy as np
from scipy.linalg import solve_discrete_are


def finite_horizon_lqr_gains(A, B, Q, R, N, P_N=None):
    """Backward Riccati recursion.

    Returns K with shape (N, nu, nx), where u_k = -K[k] @ x_k, and the cost-to-go
    matrices P with shape (N + 1, nx, nx). P_N defaults to the DARE solution.
    """
    nx, nu = A.shape[0], B.shape[1]
    if P_N is None:
        P_N = solve_discrete_are(A, B, Q, R)
    K = np.zeros((N, nu, nx))
    P = np.zeros((N + 1, nx, nx))
    P[N] = P_N

    # Backward pass: gains depend only on (A, B, Q, R, P_N), not on the state
    for k in range(N - 1, -1, -1):
        K[k] = np.linalg.solve(R + B.T @ P[k + 1] @ B, B.T @ P[k + 1] @ A)
        P[k] = Q + A.T @ P[k + 1] @ (A - B @ K[k])
    return K, P


def rollout(A, B, K, x0):
    """Apply the time-varying gains over the horizon from x0."""
    x = [np.asarray(x0, dtype=float)]
    u = []
    for k in range(K.shape[0]):
        u.append(-K[k] @ x[-1])
        x.append(A @ x[-1] + B @ u[-1])
    return np.array(x), np.array(u)
```

## Receding-Horizon Use

The gains depend on (A, B, Q, R, N, P_N), not on the measured state. For a fixed LTI model, compute the gain sequence once:

- Finite task of N steps: apply u_k = -K[k] @ x_k for k = 0..N-1 using the stored sequence.
- Receding horizon with a fixed LTI model and no constraints: re-solving at every step returns the same K[0], so the loop is the constant state feedback u = -K[0] @ x. Compute K[0] once and reuse it.
- Re-run the recursion only when the model, weights, or horizon change, for example after re-linearizing a nonlinear plant around a new operating point.

This is unconstrained LQR. With input, rate, or state limits, receding-horizon control means solving a constrained QP at every step (e.g. OSQP, cvxpy, or CasADi with a QP solver). Clipping the LQR output to the limits does not give the constrained optimum.
