---
name: pid-controller
description: Use this skill when implementing discrete-time PID control loops for any feedback control system (speed, temperature, position, pressure, flow), including output limits, anti-windup, filtered derivative on measurement, setpoint weighting, bumpless transfer, and manual tuning.
---

# PID Controller Implementation

## Overview

A PID (Proportional-Integral-Derivative) controller is a feedback control mechanism used in industrial control systems. It continuously calculates an error value and applies a correction based on proportional, integral, and derivative terms.

## Control Law

```
output = Kp * error + Ki * integral(error) + Kd * derivative(error)
```

Where:
- `error` = setpoint - measured_value
- `Kp` = proportional gain (reacts to current error)
- `Ki` = integral gain (reacts to accumulated error)
- `Kd` = derivative gain (reacts to the rate of change)

The implementation below takes the derivative of the filtered measurement instead of the error: `-Kd * d(y_f)/dt`. For a constant setpoint this equals the error derivative, but a setpoint step no longer produces a derivative kick.

## Discrete-Time Implementation

```python
import math


class PIDController:
    def __init__(self, kp, ki, kd, output_min=None, output_max=None, n_filter=10.0):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.output_min = -math.inf if output_min is None else output_min
        self.output_max = math.inf if output_max is None else output_max
        self.n_filter = n_filter  # derivative filter time constant Tf = Td / N, Td = kd / kp
        self.reset()

    def reset(self):
        """Clear controller state."""
        self.integral = 0.0
        self.d_filtered = 0.0
        self.prev_measurement = None  # None until the first sample: no startup derivative spike

    def compute(self, setpoint, measurement, dt):
        """Compute control output from setpoint, measurement, and timestep."""
        error = setpoint - measurement

        # Proportional term
        p_term = self.kp * error

        # Derivative on measurement with a first-order low-pass filter
        if self.prev_measurement is not None and dt > 0:
            raw = (measurement - self.prev_measurement) / dt
            tf = (self.kd / self.kp) / self.n_filter if self.kp else 0.0
            self.d_filtered += dt / (tf + dt) * (raw - self.d_filtered)
        self.prev_measurement = measurement
        d_term = -self.kd * self.d_filtered

        # Integral term with conditional-integration anti-windup
        integral_new = self.integral + error * dt
        unsat = p_term + self.ki * integral_new + d_term
        winding_high = unsat > self.output_max and self.ki * error > 0
        winding_low = unsat < self.output_min and self.ki * error < 0
        if not (winding_high or winding_low):
            self.integral = integral_new
        i_term = self.ki * self.integral

        # Total output, clamped to the actuator range
        output = p_term + i_term + d_term
        return min(max(output, self.output_min), self.output_max)
```

## Anti-Windup

Integral windup occurs when the output saturates but the integral keeps accumulating. Solutions:

1. **Conditional integration** (used above): skip the integral update when the output is saturated and the error would push it further into saturation
2. **Back-calculation**: integrate `error + (u_clamped - u_unsat) / (ki * Tt)` instead of `error`, with tracking time Tt between Ti and Td (often sqrt(Ti * Td)); the integral bleeds off while the output is clamped
3. **Integral clamping**: limit the integral term to the output range; simplest, but slower to recover

## Setpoint Weighting and Bumpless Transfer

- **Setpoint weighting**: use `kp * (b * setpoint - measurement)` for the proportional term with `0 <= b <= 1` to reduce overshoot after setpoint steps without slowing disturbance rejection. The derivative above already uses weight 0 on the setpoint; the integral must keep the full error for zero offset.
- **Bumpless transfer**: when switching from manual to automatic, or changing gains online, set the integral so the controller output equals the current actuator value: `integral = (u_current - p_term - d_term) / ki`. Also set `prev_measurement` to the current measurement so the derivative starts from zero.

## Tuning Guidelines

**Manual Tuning:**
1. Set Ki = Kd = 0
2. Increase Kp until acceptable response speed
3. Add Ki to eliminate steady-state error
4. Add Kd to reduce overshoot

**Effect of Each Gain:**
- Higher Kp -> faster response, more overshoot
- Higher Ki -> eliminates steady-state error, can cause oscillation
- Higher Kd -> reduces overshoot, sensitive to noise
