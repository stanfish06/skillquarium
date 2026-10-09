# Instance types on Render

**Plan** specs for Web Services, Private Services, and Background Workers, from Render's
[Compute Plans](https://render.com/docs/compute-plans) reference. Private Services and
Background Workers have the same ladder minus `free`, which is web-service only.

## Plan and spec table

| Plan ID | Legacy name | CPU | RAM |
|---------|-------------|-----|-----|
| `free` | — | 0.1 | 512 MB |
| `0.5c-512mb` | `starter` | 0.5 | 512 MB |
| `1c-2g` | `standard` | 1 | 2 GB |
| `2c-4g` | `pro` | 2 | 4 GB |
| `2c-8g` | — | 2 | 8 GB |
| `2c-16g` | — | 2 | 16 GB |
| `4c-8g` | `pro_plus` | 4 | 8 GB |
| `4c-16g` | `pro_max` | 4 | 16 GB |
| `4c-32g` | — | 4 | 32 GB |
| `8c-16g` | — | 8 | 16 GB |
| `8c-32g` | `pro_ultra` | 8 | 32 GB |
| `8c-64g` | — | 8 | 64 GB |
| `12c-24g` | — | 12 | 24 GB |
| `12c-48g` | — | 12 | 48 GB |
| `12c-96g` | — | 12 | 96 GB |

Plan IDs are what the dashboard, API, and docs show; the six legacy names are still
accepted in `render.yaml` and the API. `starter_plus` and `standard_plus` are not —
they were removed from the lineup and a blueprint that sets either is rejected.
Monthly prices are per-plan on [Render pricing](https://render.com/pricing); read
them there rather than from a table that goes stale.

> **Note:** CPU and RAM above are the documented plan specs. Billing depends on usage, proration, and promotions, so use [render.com/pricing](https://render.com/pricing) for rates.

## Flexible vs non-flexible plans

Some plans are **flexible** (usable in mixed configurations such as **preview environments** alongside other instance types where the platform allows it); others are **non-flexible**. Exact flexible-plan rules depend on workspace and product updates—confirm in the Dashboard or docs when mixing preview and production instance types.

## When to scale up vs out

- **Scale up** (larger **plan**): **Memory-intensive** apps, **single-process** or **single-threaded** architectures, workloads that need **more CPU per request** or **larger heap** without sharding.
- **Scale out** (more **instances**): **Stateless** request handlers, **high concurrency**, **even load distribution** across identical processes.
- **Both**: Start with a **right-sized plan**, then add **horizontal** scaling as traffic grows. Avoid tiny instances multiplied many times if each process needs substantial RAM.

## Free tier limitations

- **Single instance** for the service.
- Web services **spin down after inactivity** (cold starts on the next request).
- **Limited** CPU and memory vs paid plans—treat free-tier behavior as distinct when advising on performance and scaling.
