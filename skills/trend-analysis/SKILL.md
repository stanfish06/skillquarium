---
name: trend-analysis
description: Detect long-term trends in time series data using parametric and non-parametric methods. Use when determining if a variable shows statistically significant increase or decrease over time.
license: MIT
---

# Trend Analysis Guide

## Overview

Trend analysis determines whether a time series shows a statistically significant long-term increase or decrease. This guide covers both parametric (linear regression) and non-parametric (Sen's slope) methods.

## Parametric Method: Linear Regression

Linear regression fits a straight line to the data and tests if the slope is significantly different from zero.
```python
from scipy import stats

slope, intercept, r_value, p_value, std_err = stats.linregress(years, values)

print(f"Slope: {slope:.2f} units/year")
print(f"p-value: {p_value:.3g}")
```

### Assumptions

- Linear relationship between time and variable
- Residuals are normally distributed
- Homoscedasticity (constant variance)

## Non-Parametric Method: Sen's Slope with Mann-Kendall Test

Sen's slope is robust to outliers and does not assume normality. Recommended for environmental data.
```python
import pymannkendall as mk

result = mk.original_test(values)

print(result.slope)  # Sen's slope (rate of change per time unit)
print(result.p)      # p-value for significance
print(result.trend)  # 'increasing', 'decreasing', or 'no trend'
```

### Serial Autocorrelation

`original_test` assumes independent observations. Positive serial autocorrelation, common in annual climate, hydrology, and lake records, makes it report significant trends too often. Check the lag-1 autocorrelation and use a modified test when it is non-negligible:

```python
import numpy as np
import pymannkendall as mk

x = np.asarray(values, dtype=np.float64)
d = x - x.mean()
r1 = np.sum(d[:-1] * d[1:]) / np.sum(d ** 2)   # lag-1 autocorrelation

mk.hamed_rao_modification_test(x)                 # variance correction (Hamed & Rao 1998)
mk.yue_wang_modification_test(x)                  # variance correction (Yue & Wang 2004)
mk.pre_whitening_modification_test(x)             # removes lag-1 AR before testing
mk.trend_free_pre_whitening_modification_test(x)  # TFPW: detrends before pre-whitening
mk.seasonal_test(x, period=12)                    # monthly data with seasonality
mk.correlated_seasonal_test(x, period=12)         # seasonality plus serial correlation
```

All return the same result fields (`trend`, `p`, `slope`). Report which test you used.

### Comparison

| Method | Pros | Cons |
|--------|------|------|
| Linear Regression | Easy to interpret, gives R² | Sensitive to outliers |
| Sen's Slope | Robust to outliers, no normality assumption | Slightly less statistical power |

## Significance Levels

| p-value | Interpretation |
|---------|----------------|
| p < 0.01 | Highly significant trend |
| p < 0.05 | Significant trend |
| p < 0.10 | Marginally significant |
| p >= 0.10 | No significant trend |

## Example: Annual Precipitation Trend
```python
import pandas as pd
import pymannkendall as mk

# Load annual precipitation data
df = pd.read_csv('precipitation.csv')
precip = df['Precipitation'].values

# Run Mann-Kendall test
result = mk.original_test(precip)
print(f"Sen's slope: {result.slope:.2f} mm/year")
print(f"p-value: {result.p:.3g}")
print(f"Trend: {result.trend}")
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| p-value = NaN | NaN in the input (`linregress` propagates it; pymannkendall drops missing values) | Drop NaNs with an `np.isfinite` mask before `linregress` |
| Never significant | Very short series: Mann-Kendall cannot reach p < 0.05 (two-sided) with n <= 4, and its normal approximation is rough below n ~ 10 | Collect more data or report the test as underpowered |
| Conflicting results | Linear regression assumes normal, independent residuals; Mann-Kendall is rank-based | Check outliers and autocorrelation, and report both. Sen's slope estimates the magnitude; the Mann-Kendall p-value tests significance |
| Slope near zero but significant | Large sample size | Check practical significance |

## Best Practices

- Use at least 10 data points for reliable results
- Prefer Sen's slope for environmental time series
- Report both slope magnitude and p-value
- State which test variant was used (original or autocorrelation-corrected)
