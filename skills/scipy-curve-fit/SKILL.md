---
name: scipy-curve-fit
description: Use scipy.optimize.curve_fit for nonlinear least squares parameter estimation from experimental data.
---

# Using scipy.optimize.curve_fit for Parameter Estimation

## Overview

`scipy.optimize.curve_fit` is a tool for fitting models to experimental data using nonlinear least squares optimization.

## Basic Usage

```python
from scipy.optimize import curve_fit
import numpy as np

# Define your model function
def model(x, param1, param2):
    return param1 * (1 - np.exp(-x / param2))

# Fit to data
popt, pcov = curve_fit(model, x_data, y_data)

# popt contains the optimal parameters [param1, param2]
# pcov contains the covariance matrix
```

## Fitting a First-Order Step Response

```python
import numpy as np
from scipy.optimize import curve_fit

# Known values from experiment
y_initial = ...  # Initial output value
u = ...          # Input magnitude during step test

# Define the step response model
def step_response(t, K, tau):
    """First-order step response with fixed initial value and input."""
    return y_initial + K * u * (1 - np.exp(-t / tau))

# Your experimental data
t_data = np.array([...])  # Time points
y_data = np.array([...])  # Output readings

# Perform the fit
popt, pcov = curve_fit(
    step_response,
    t_data,
    y_data,
    p0=[K_guess, tau_guess],      # Initial guesses
    bounds=([K_min, tau_min], [K_max, tau_max])  # Parameter bounds
)

K_estimated, tau_estimated = popt
```

## Setting Initial Guesses (p0)

Good initial guesses speed up convergence:

```python
# Estimate K from steady-state data
K_guess = (y_data[-1] - y_initial) / u

# Estimate tau from 63.2% rise time
y_63 = y_initial + 0.632 * (y_data[-1] - y_initial)
idx_63 = np.argmin(np.abs(y_data - y_63))
tau_guess = t_data[idx_63]

p0 = [K_guess, tau_guess]
```

## Setting Parameter Bounds

Bounds prevent physically impossible solutions:

```python
tau_min = 1e-6  # small positive floor: tau = 0 makes exp(-t / tau) divide by zero
bounds = (
    [lower_K, tau_min],      # Lower bounds
    [upper_K, upper_tau]     # Upper bounds
)

# curve_fit raises ValueError if p0 lies outside the bounds; clip it in
p0 = np.clip(p0, bounds[0], bounds[1])
```

## Parameter Uncertainty

`pcov` is the estimated covariance matrix of `popt`; the square roots of its diagonal are the 1-sigma parameter errors.

```python
popt, pcov = curve_fit(model, x_data, y_data, p0=p0, sigma=y_err, absolute_sigma=True)
perr = np.sqrt(np.diag(pcov))          # 1-sigma errors, same order as popt
corr = pcov / np.outer(perr, perr)     # parameter correlation matrix

if not np.all(np.isfinite(pcov)):
    raise RuntimeError("covariance not estimated; parameters are not identifiable from these data")
```

- `sigma`: per-point standard deviations of `y_data` (residuals are divided by `sigma`, so points are weighted by `1/sigma**2`), or a 2-D covariance matrix of `y_data`.
- `absolute_sigma=True`: `sigma` are true measurement errors and `pcov` is used as computed.
- `absolute_sigma=False` (default): only relative `sigma` matter; `pcov` is rescaled by the reduced chi-square `sum(r**2) / (N - n_params)`, so errors follow the observed scatter.
- `pcov` filled with `inf` (with `OptimizeWarning: Covariance of the parameters could not be estimated`) means a rank-deficient Jacobian or `N <= n_params`. With bounds, curve_fit uses `trf`, which returns a pseudoinverse instead of `inf`, so also check `np.linalg.cond(pcov)` and correlations near +/-1.

## Calculating Fit Quality

### R-squared (Coefficient of Determination)

```python
# Predicted values from fitted model
y_predicted = step_response(t_data, K_estimated, tau_estimated)

# Calculate R-squared
ss_residuals = np.sum((y_data - y_predicted) ** 2)
ss_total = np.sum((y_data - np.mean(y_data)) ** 2)
r_squared = 1 - (ss_residuals / ss_total)
```

For nonlinear models R² is descriptive only: it can be negative when the fit is worse than the mean, it does not equal the squared correlation, and it is a poor basis for comparing models. Use residual plots, RMSE, reduced chi-square (with known `sigma`), or AIC/BIC for that.

### Root Mean Square Error (RMSE)

```python
residuals = y_data - y_predicted
rmse = np.sqrt(np.mean(residuals ** 2))
```

## Complete Example

```python
import numpy as np
from scipy.optimize import curve_fit

def fit_first_order(t, y, y0, u, y_err=None):
    """Fit y(t) = y0 + K*u*(1 - exp(-(t - t[0]) / tau)) to step-response arrays.

    Returns (popt, perr, r_squared, rmse) with popt = [K, tau].
    """
    t = np.asarray(t, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    t_rel = t - t[0]  # step applied at the first sample

    def model(t_rel, K, tau):
        return y0 + K * u * (1 - np.exp(-t_rel / tau))

    lower, upper = [-np.inf, 1e-6], [np.inf, np.inf]
    K_guess = (y[-1] - y0) / u
    idx_63 = np.argmin(np.abs(y - (y0 + 0.632 * (y[-1] - y0))))
    p0 = np.clip([K_guess, t_rel[idx_63]], lower, upper)

    popt, pcov = curve_fit(model, t_rel, y, p0=p0, bounds=(lower, upper),
                           sigma=y_err, absolute_sigma=y_err is not None)
    perr = np.sqrt(np.diag(pcov))

    residuals = y - model(t_rel, *popt)
    r_squared = 1 - np.sum(residuals ** 2) / np.sum((y - y.mean()) ** 2)
    rmse = np.sqrt(np.mean(residuals ** 2))
    return popt, perr, r_squared, rmse
```

## Common Issues

1. **RuntimeError**: Optimal parameters not found
   - Try better initial guesses
   - Check that data is valid (no NaN, reasonable range)

2. **Poor fit (low R^2)**:
   - Data might not be from step response phase
   - System might not be first-order
   - Too much noise in measurements

3. **Unrealistic parameters**:
   - Add bounds to constrain solution
   - Check units are consistent
