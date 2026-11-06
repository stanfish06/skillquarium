---
name: lomb-scargle-periodogram
description: Lomb-Scargle periodogram for finding periodic signals in unevenly sampled time series data. Use when analyzing light curves, radial velocity data, or any astronomical time series to detect periodic variations. Works for stellar rotation, pulsation, eclipsing binaries, and general periodic phenomena. Based on lightkurve library.
---

# Lomb-Scargle Periodogram

The Lomb-Scargle periodogram is the standard tool for finding periods in unevenly sampled astronomical time series data. It's particularly useful for detecting periodic signals in light curves from space missions like Kepler, K2, and TESS.

## Overview

The Lomb-Scargle periodogram extends the classical periodogram to handle unevenly sampled data, which is common in astronomy due to observing constraints, data gaps, and variable cadences.

## Basic Usage with Lightkurve

```python
import lightkurve as lk
import numpy as np

# Create a light curve object
lc = lk.LightCurve(time=time, flux=flux, flux_err=error)

# Create periodogram (specify maximum period to search)
pg = lc.to_periodogram(maximum_period=15)  # Search up to 15 days

# Find strongest period
strongest_period = pg.period_at_max_power
max_power = pg.max_power

print(f"Strongest period: {strongest_period:.5f} days")
print(f"Power: {max_power:.5f}")
```

`to_periodogram` defaults to `normalization='amplitude'`: power is the amplitude of the best-fit sinusoid in flux units. Pass `normalization='psd'` for power spectral density, e.g. `lc.to_periodogram(normalization='psd', maximum_period=15)`. Neither is a significance measure; see *False-Alarm Probability with astropy* below.

## Plotting Periodograms

```python
import matplotlib.pyplot as plt

pg.plot(view='period')  # View vs period (not frequency)
plt.xlabel('Period [days]')
plt.ylabel('Power')
plt.show()
```

**Important**: Use `view='period'` to see periods directly, not frequencies. The default `view='frequency'` shows frequency (1/period).

## Period Range Selection

Choose appropriate period ranges based on your science case:

- **Stellar rotation**: 0.1 - 100 days
- **Exoplanet transits**: use BLS or TLS instead (see the end of this guide); short box-shaped dips spread Lomb-Scargle power over many harmonics
- **Eclipsing binaries**: 0.1 - 100 days
- **Stellar pulsations**: 0.001 - 1 day

```python
# Search specific period range
pg = lc.to_periodogram(minimum_period=2.0, maximum_period=7.0)
```

## Interpreting Results

### Power Significance

Higher power indicates stronger periodic signal, but be cautious:
- **High power**: not significance by itself; compute a false-alarm probability (below)
- **Multiple peaks**: Could indicate harmonics (period/2, period*2)
- **Aliasing**: Very short periods may be aliases of longer periods

### Common Patterns

1. **Single strong peak**: Likely the true period
2. **Harmonics**: Peaks at period/2, period*2 suggest the fundamental period
3. **Aliases**: Check if period*2 or period/2 also show signals

## False-Alarm Probability with astropy

lightkurve wraps `astropy.timeseries.LombScargle`; use it directly for normalization control and false-alarm probabilities (FAP).

```python
import numpy as np
from astropy.timeseries import LombScargle

fmin, fmax = 1 / 15, 1 / 0.1   # 1/day: periods 0.1-15 days
ls = LombScargle(t, y, dy, normalization='standard')
frequency, power = ls.autopower(minimum_frequency=fmin, maximum_frequency=fmax,
                                samples_per_peak=10)
best = np.argmax(power)
best_period = 1 / frequency[best]

grid = dict(minimum_frequency=fmin, maximum_frequency=fmax, samples_per_peak=10)
fap = ls.false_alarm_probability(power[best], method='baluev', **grid)
power_1pct = ls.false_alarm_level(0.01, method='baluev', **grid)   # power needed for FAP = 1%
```

- `normalization`: `'standard'` (default; 0-1, fraction of chi-square reduced by the sinusoid), `'model'`, `'log'`, or `'psd'` (unnormalized). Compare powers only under the same normalization.
- `method`: `'baluev'` (default, fast analytic upper bound, accurate for small FAP), `'bootstrap'` (resamples the data, slow but makes no analytic approximation), plus `'davies'` and `'naive'`. FAP is implemented for `nterms=1` only.
- Frequency grid: `autopower` spaces frequencies by `1 / (samples_per_peak * baseline)`; use 5-10 samples per peak and set `maximum_frequency` explicitly, since the default upper limit comes from `nyquist_factor` times the mean sampling rate.
- FAP assumes white noise; red noise from stellar variability makes it optimistic.

## Model Fitting

Once you find a period, you can fit a model:

```python
# Get the frequency at maximum power
frequency = pg.frequency_at_max_power

# Create a model light curve
model = pg.model(time=lc.time, frequency=frequency)

# Plot data and model
import matplotlib.pyplot as plt
lc.plot(label='Data')
model.plot(label='Model')
plt.legend()
plt.show()
```

## Dependencies

```bash
pip install lightkurve numpy matplotlib
```

## References

- [Lightkurve Tutorials](https://lightkurve.github.io/lightkurve/tutorials/index.html)
- [Lightkurve Periodogram Documentation](https://docs.lightkurve.org/)

## When to Use This vs. Other Methods

- **Lomb-Scargle**: General periodic signals (rotation, pulsation, eclipsing binaries)
- **Transit Least Squares (TLS)**: Specifically for exoplanet transits (more sensitive)
- **Box Least Squares (BLS)**: Alternative transit detection method

For exoplanet transits, search with BLS (`lc.to_periodogram(method='bls')` or `astropy.timeseries.BoxLeastSquares`) or TLS; use Lomb-Scargle to find and remove stellar variability first.
