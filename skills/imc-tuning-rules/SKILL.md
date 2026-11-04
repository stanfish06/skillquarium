---
name: imc-tuning-rules
description: Calculate PI controller gains using Internal Model Control (IMC) and Skogestad SIMC tuning rules for first-order and first-order-plus-dead-time (FOPDT) process models, with a PI implementation that has output limits and anti-windup.
---

# IMC Tuning Rules for PI/PID Controllers

## Overview

Internal Model Control (IMC) is a systematic method for tuning PI/PID controllers based on a process model. Once you've identified system parameters (K and tau), IMC provides controller gains.

## Why IMC?

- **Model-based**: Uses identified process parameters directly
- **Single tuning parameter**: Just choose the closed-loop speed (lambda)
- **Guaranteed stability**: For first-order systems, always stable if model is accurate
- **Predictable response**: Closed-loop time constant equals lambda

## IMC Tuning for First-Order Systems

For a first-order process with gain K and time constant tau:

```
Process: G(s) = K / (tau*s + 1)
```

The IMC-tuned PI controller gains are:

```
Kp = tau / (K * lambda)
Ki = Kp / tau = 1 / (K * lambda)
Kd = 0  (derivative not needed for first-order systems)
```

Where:
- `Kp` = Proportional gain
- `Ki` = Integral gain (units: 1/time)
- `Kd` = Derivative gain (zero for first-order)
- `lambda` = Desired closed-loop time constant (tuning parameter)

**Gain form.** These gains are for the parallel (independent-gain) PI form used in the code below:

```
u = Kp * e + Ki * ∫e dt,   Ki = Kp / tau_I
```

The ideal (ISA standard) form `u = Kc * (e + (1/tau_I) * ∫e dt)` has Kc = Kp and takes the integral time tau_I instead of Ki (here tau_I = tau). For PI the series form is the same as the ideal form. Convert before entering gains into a controller that expects another form, and check whether it wants tau_I in seconds, minutes, or repeats per minute (1/tau_I).

## SIMC Rules for Processes with Dead Time

Most real processes have a dead time theta:

```
Process: G(s) = K * exp(-theta*s) / (tau*s + 1)
```

Skogestad's SIMC rules give PI gains for a desired closed-loop time constant tau_c:

```
Kc    = tau / (K * (tau_c + theta))
tau_I = min(tau, 4 * (tau_c + theta))
Ki    = Kc / tau_I          (parallel form)
```

- Default `tau_c = theta`: a good trade-off between speed and robustness (gain margin about 3). Larger tau_c is slower and more robust.
- The `4 * (tau_c + theta)` term takes over for lag-dominant processes (tau much larger than theta) and speeds up rejection of input disturbances.
- With theta = 0 the default does not apply; choose tau_c = lambda from the table below. For lambda >= tau/4 the rule reduces to the IMC gains above.

## Choosing Lambda Without Dead Time

Lambda controls the trade-off between speed and robustness:

| Lambda | Behavior |
|--------|----------|
| `lambda = 0.1 * tau` | Very aggressive, fast but sensitive to model error |
| `lambda = 0.5 * tau` | Aggressive, good for accurate models |
| `lambda = 1.0 * tau` | Moderate, balanced speed and robustness |
| `lambda = 2.0 * tau` | Conservative, robust to model uncertainty |

**Default recommendation**: Start with `lambda = tau`

For noisy systems or uncertain models, use larger lambda.
For precise models and fast response needs, use smaller lambda.

## Implementation

```python
def calculate_imc_gains(K, tau, lambda_factor=1.0):
    """
    Calculate IMC-tuned PI gains for a first-order system.

    Args:
        K: Process gain
        tau: Time constant
        lambda_factor: Multiplier for lambda (default 1.0 = lambda equals tau)

    Returns:
        dict with Kp, Ki, Kd, lambda
    """
    lambda_cl = lambda_factor * tau

    Kp = tau / (K * lambda_cl)
    Ki = Kp / tau
    Kd = 0.0

    return {
        "Kp": Kp,
        "Ki": Ki,
        "Kd": Kd,
        "lambda": lambda_cl,
    }


def calculate_simc_gains(K, tau, theta, tau_c=None):
    """
    SIMC PI gains for an FOPDT process K * exp(-theta*s) / (tau*s + 1).

    Args:
        K: Process gain
        tau: Time constant
        theta: Dead time (>= 0)
        tau_c: Desired closed-loop time constant (default: theta)

    Returns:
        dict with Kp (= Kc), Ki (parallel form), Kd, tau_I, tau_c
    """
    if tau_c is None:
        if theta <= 0:
            raise ValueError("theta = 0: choose tau_c explicitly (e.g. tau_c = tau)")
        tau_c = theta

    Kc = tau / (K * (tau_c + theta))
    tau_I = min(tau, 4.0 * (tau_c + theta))

    return {
        "Kp": Kc,
        "Ki": Kc / tau_I,
        "Kd": 0.0,
        "tau_I": tau_I,
        "tau_c": tau_c,
    }
```

## PI Controller Implementation

```python
class PIController:
    def __init__(self, Kp, Ki, setpoint, output_min=float("-inf"), output_max=float("inf")):
        self.Kp = Kp
        self.Ki = Ki
        self.setpoint = setpoint
        self.output_min = output_min
        self.output_max = output_max
        self.integral = 0.0

    def reset(self):
        self.integral = 0.0

    def compute(self, measurement, dt):
        """Parallel-form PI with clamping anti-windup (conditional integration)."""
        error = self.setpoint - measurement

        # Tentative integral update and unsaturated output
        integral_new = self.integral + error * dt
        unsat = self.Kp * error + self.Ki * integral_new

        # Anti-windup: skip the update when the output is saturated and the
        # integral would push it further past the limit (Ki * error sign handles reverse action)
        winding_high = unsat > self.output_max and self.Ki * error > 0
        winding_low = unsat < self.output_min and self.Ki * error < 0
        if not (winding_high or winding_low):
            self.integral = integral_new

        # PI control law, clamped to the actuator range
        output = self.Kp * error + self.Ki * self.integral
        return max(self.output_min, min(self.output_max, output))
```

## Expected Closed-Loop Behavior

With IMC tuning, the closed-loop response is approximately:

```
y(t) = y_setpoint * (1 - exp(-t / lambda))
```

Key properties:
- **Rise time**: ~2.2 * lambda from 10% to 90% of the step; ~2.3 * lambda from 0% to 90% (with dead time, add theta when measuring from the setpoint change)
- **Settling time**: ~4 * lambda to reach 98% of setpoint
- **Overshoot**: Minimal for first-order systems
- **Steady-state error**: Zero (integral action eliminates offset)

## Tips

1. **Start conservative**: Use `lambda = tau` initially
2. **Decrease lambda carefully**: Smaller lambda = larger Kp = faster but riskier
3. **Watch for oscillation**: If output oscillates, increase lambda
4. **Anti-windup**: Set output_min/output_max to the actuator limits so the controller stops integrating while the output is saturated in the direction of the error
