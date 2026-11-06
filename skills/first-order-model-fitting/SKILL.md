---
name: first-order-model-fitting
description: Fit first-order and first-order-plus-dead-time (FOPDT) models to experimental step response data and extract K (gain), tau (time constant), and theta (dead time), using a measured pre-step baseline, two-point estimates, and scipy curve_fit with bounds.
---

# First-Order System Model Fitting

## Overview

Many physical systems (thermal, electrical, mechanical) exhibit first-order dynamics. This skill explains the mathematical model and how to extract parameters from experimental data.

## The First-Order Model

The dynamics, written relative to the steady operating point (y0, u0) before the step, are:

```
tau * dy/dt + (y - y0) = K * (u(t - theta) - u0)
```

Where:
- `y` = output variable (e.g., temperature, voltage, position)
- `u` = input variable (e.g., power, current, force)
- `K` = process gain (output change per unit input at steady state)
- `tau` = time constant (seconds) - characterizes response speed
- `y0`, `u0` = measured output and input at steady state before the step (not necessarily ambient)
- `theta` = dead time between the input change and the first output response; `theta = 0` gives a pure first-order lag

## Step Response Formula

When the input steps by du = u1 - u0 at time t0, the output follows the FOPDT response:

```
y(t) = y0                                                for t < t0 + theta
y(t) = y0 + K * du * (1 - exp(-(t - t0 - theta) / tau))  for t >= t0 + theta
```

Take `y0` as the mean of the measured output over a steady pre-step window and `t0` as the logged time of the input change. Do not assume the output starts at ambient or that the step happens at t = 0. This is the key equation for fitting.

## Extracting Parameters

### Process Gain (K)

At steady state (t -> infinity), the exponential term goes to zero:

```
y_steady = y0 + K * du
```

Therefore:

```
K = (y_steady - y0) / du
```

### Time Constant (tau) and Dead Time (theta)

Without dead time, tau is the time after the step at which the output has covered 63.2% of its total change:

```
y(t0 + tau) = y0 + K*du*(1 - exp(-1))
            = y0 + 0.632 * (y_steady - y0)
```

With dead time, use the two-point method: let t28 and t63 be the times after t0 at which the output reaches 28.3% and 63.2% of (y_steady - y0). Then

```
tau   = 1.5 * (t63 - t28)
theta = t63 - tau
```

Clip theta at 0 if noise makes it slightly negative. Use these estimates as the initial guess for curve fitting.

## Model Function for Curve Fitting

```python
import numpy as np
from scipy.optimize import curve_fit


def fopdt_step(t, K, tau, theta, y0, t0, du):
    """FOPDT step response; the output stays at y0 until t0 + theta."""
    s = np.clip(t - t0 - theta, 0.0, None)
    return y0 + K * du * (1.0 - np.exp(-s / tau))
```

Fix the measured baseline `y0`, step time `t0`, and input change `du`, and fit `K`, `tau`, `theta` with bounds `tau > 0`, `theta >= 0`. K is left unbounded because reverse-acting processes have K < 0:

```python
def fit_fopdt(t, y, t0, du):
    t = np.asarray(t, dtype=float)
    y = np.asarray(y, dtype=float)
    y0 = float(np.mean(y[t < t0]))  # measured pre-step baseline

    post = t >= t0
    tp, yp = t[post], y[post]

    # Initial guess from the two-point method
    y_ss = float(np.mean(yp[-max(1, len(yp) // 10):]))
    frac = (yp - y0) / (y_ss - y0)
    t28 = tp[np.argmax(frac >= 0.283)] - t0
    t63 = tp[np.argmax(frac >= 0.632)] - t0
    tau0 = max(1.5 * (t63 - t28), 1e-6)
    theta0 = max(t63 - tau0, 0.0)
    K0 = (y_ss - y0) / du

    def model(tt, K, tau, theta):
        return fopdt_step(tt, K, tau, theta, y0, t0, du)

    popt, pcov = curve_fit(
        model, tp, yp,
        p0=[K0, tau0, theta0],
        bounds=([-np.inf, 1e-9, 0.0], [np.inf, np.inf, tp[-1] - t0]),
    )
    K, tau, theta = popt
    return {"K": K, "tau": tau, "theta": theta, "y0": y0, "stderr": np.sqrt(np.diag(pcov))}
```

The record needs a steady pre-step window (`t < t0`) and must reach steady state after the step. If the process has no measurable delay, drop `theta` from the fitted parameters and pass `theta=0`.

## Practical Tips

1. **Fit from the step time**: Use samples from t0 onward; the flat stretch between t0 and t0 + theta identifies the dead time, so keep it
2. **Measure the baseline**: Average a steady pre-step window for y0; a drifting baseline biases K and tau
3. **Handle noisy data**: Fitting naturally averages out measurement noise
4. **Check units**: K has units of output units / input units
5. **Test duration and sampling**: Record a steady pre-step window, then at least theta + 3-5 tau after the step so the new steady state is visible, and sample at least 10 points per tau

## Quality Metrics

After fitting, calculate:
- **R-squared (R^2)**: How well the model explains variance (want > 0.9)
- **Fitting error**: RMS difference between model and data

```python
residuals = y_measured - y_model
ss_res = np.sum(residuals**2)
ss_tot = np.sum((y_measured - np.mean(y_measured))**2)
r_squared = 1 - (ss_res / ss_tot)
fitting_error = np.sqrt(np.mean(residuals**2))
```
