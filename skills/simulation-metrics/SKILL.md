---
name: simulation-metrics
description: Use this skill when calculating step-response performance metrics such as rise time, overshoot percentage, steady-state error, or settling time for evaluating simulation results, including steps from a nonzero initial value and downward steps.
---

# Step-Response Performance Metrics

All metrics are relative to the step itself, not to zero:

- `y0`: output value just before the step; `t0`: time of the step
- `y_final`: reference final value (the setpoint, or the measured steady state if the loop has offset)
- Thresholds are `y0 + p * (y_final - y0)`, so downward steps work unchanged
- Only samples with `t >= t0` are used, and times are reported relative to t0 where noted
- Functions return `None` when a metric is undefined (zero step size, a threshold never reached, or the response not settled at the last sample); `overshoot_percent` returns 0.0 when the response never passes `y_final`
- Values are taken at sample times without interpolation, so resolution is one sample period

## Rise Time

Time for the response to go from 10% to 90% of the step (y_final - y0), using samples after t0.

```python
def rise_time(times, values, y0, y_final, t0=0.0, low=0.1, high=0.9):
    """Rise time from low to high fraction of the step; None if undefined."""
    step = y_final - y0
    if step == 0:
        return None
    t_low = t_high = None

    for t, v in zip(times, values):
        if t < t0:
            continue
        frac = (v - y0) / step  # progress toward y_final; sign-correct for downward steps
        if t_low is None and frac >= low:
            t_low = t
        if frac >= high:
            t_high = t
            break

    if t_low is None or t_high is None:
        return None
    return t_high - t_low
```

## Overshoot

Peak excursion beyond y_final, as a percentage of the step size |y_final - y0|.

```python
def overshoot_percent(times, values, y0, y_final, t0=0.0):
    """Overshoot in percent of |y_final - y0|; 0.0 if none, None if undefined."""
    step = y_final - y0
    post = [v for t, v in zip(times, values) if t >= t0]
    if step == 0 or not post:
        return None
    # Largest progress fraction; > 1 means the response went past y_final
    peak_frac = max((v - y0) / step for v in post)
    return max(0.0, (peak_frac - 1.0) * 100.0)
```

## Steady-State Error

Difference between target and final settled value.

```python
def steady_state_error(values, target, final_fraction=0.1):
    """Calculate steady-state error using final portion of data."""
    n = len(values)
    start = int(n * (1 - final_fraction))
    final_avg = sum(values[start:]) / len(values[start:])
    return abs(target - final_avg)
```

## Settling Time

Time after t0 at which the response enters and stays within ±tolerance·|y_final - y0| of y_final (default 2%; 5% is the other common convention).

```python
def settling_time(times, values, y0, y_final, t0=0.0, tolerance=0.02):
    """Settling time relative to t0; None if the step is zero or the last sample is outside the band."""
    step = y_final - y0
    if step == 0:
        return None
    band = tolerance * abs(step)

    settled_at = None
    for t, v in zip(times, values):
        if t < t0:
            continue
        if abs(v - y_final) > band:
            settled_at = None
        elif settled_at is None:
            settled_at = t

    return None if settled_at is None else settled_at - t0
```

A record that ends shortly after entering the band can report a settling time that later samples would contradict; simulate long enough to see the response stay settled.

## Usage

```python
times = [row["time"] for row in results]
values = [row["value"] for row in results]
t0 = 0.0          # time of the setpoint step
y0 = values[0]    # value just before the step
y_final = setpoint

print(f"Rise time: {rise_time(times, values, y0, y_final, t0)}")
print(f"Overshoot: {overshoot_percent(times, values, y0, y_final, t0)}%")
print(f"Settling time: {settling_time(times, values, y0, y_final, t0)}")
print(f"SS Error: {steady_state_error(values, y_final)}")
```

For a cross-check, python-control's `control.step_info(y - y0, t - t0)` on numpy arrays of the post-step samples reports rise time, settling time, overshoot, and peak with the same 10-90% and 2% defaults; it assumes the response starts at 0, hence the shift.
