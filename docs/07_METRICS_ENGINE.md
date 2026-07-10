# Metrics Engine

**Status:** Partial — wall + rusage + disk-usage (S15); docker-stats (S25); opt-in IQR outliers (S21)  
**Last updated:** July 2026

---

## 1. Purpose

The metrics engine defines **what is measured**, **how samples are collected**, and **how aggregates are computed**. It produces typed numeric samples attached to each `StageResult` and rollups for reports.

---

## 2. Design Principles

1. **Wall clock is mandatory** — every stage iteration has `durationMs`.
2. **Collectors are composable** — enable only what the profile needs.
3. **Aggregation is pure** — given samples, aggregates are deterministic.
4. **Units are explicit** — milliseconds, bytes, percent; never ambiguous “units.”
5. **Warmup is labeled** — warmup samples stored but excluded from primary aggregates when configured.

---

## 3. Metric Categories

| Category | Examples | Default |
|----------|----------|---------|
| Latency | `durationMs` | On |
| Process resource | `cpuUserMs`, `cpuSystemMs`, `maxRssBytes` | Optional |
| Disk | `readBytes`, `writeBytes` | Optional / best-effort |
| Package manager | `dependencyCount`, `lockfilePresent` | Derived metadata |
| Docker | `containerCpuPercentAvg`, `containerMemMaxBytes` | Optional |
| Quality | `exitCode` | On |

---

## 4. Collector Interface

```typescript
interface Collector {
  id: string;
  start(ctx: StageContext): Promise<void> | void;
  stop(ctx: StageContext): Promise<MetricSample[]> | MetricSample[];
}

type MetricSample = {
  name: string;
  value: number;
  unit: "ms" | "bytes" | "count" | "percent" | "ratio";
  tags?: Record<string, string>;
};
```

Collectors must be safe if `stop` is called after failure.

---

## 5. Built-in Collectors

### 5.1 `wall` (implemented — S5)

- Uses monotonic clock: `process.hrtime.bigint()`
- Emits `durationMs` with tag `timingSource: node-hrtime`
- Safe if `stop` is called without `start` (emits ~0 ms)

### 5.2 `rusage` (S15)

- Best-effort orchestrator-process deltas via `process.resourceUsage()` / `process.memoryUsage()`
- Emits `cpuUserMs`, `cpuSystemMs`, `maxRssBytes` with tags `accuracy: best-effort`, `scope: orchestrator`
- Skips gracefully if APIs throw; not isolated child-process rusage

### 5.3 `disk-usage` (S15)

- Measures workspace directory size before/after stage (`du`-equivalent walk)
- Emits `workspaceBytesBefore`, `workspaceBytesAfter`, `workspaceBytesDelta`
- Runs outside the process wall timer (does not inflate `durationMs`)

### 5.4 `docker-stats` (S25)

- Samples `docker stats --no-stream` during the stage (interval ≥ **200ms**, default 200ms)
- Requires Docker stage context (`containerName`); skips gracefully on native runs
- Emits `containerCpuPercentAvg`, `containerCpuPercentMax`, `containerMemBytesAvg`, `containerMemMaxBytes`
- Tags: `accuracy: best-effort`, `scope: container`
- Failed ticks / empty series → no samples (never fails the stage)

### 5.5 `env-tags` (metadata)

- Not a performance metric; attaches booleans like `cacheCold: 1`

---

## 6. Aggregation

For each `(cellId, stageId, metricName)` over **measured** iterations:

| Stat | Definition |
|------|------------|
| `count` | Number of samples |
| `min` | Minimum |
| `max` | Maximum |
| `mean` | Arithmetic mean |
| `median` | p50 (average of two middle values when `n` is even) |
| `p95` | **Nearest-rank** 95th percentile (locked for v1 — see §6.1) |
| `stdev` | Sample standard deviation (n−1) for n ≥ 2; `0` when n < 2 |

Warmup iterations: stored under `results[]` with `iterationKind: warmup|measured`.

### 6.1 Locked p95 algorithm (v1)

**Nearest-rank** (1-based):

1. Sort samples ascending.
2. `rank = ceil(0.95 * n)` (clamped to `[1, n]`).
3. Take the value at 0-based index `rank - 1`.

Do **not** switch to linear interpolation without a schema/docs bump. Implementation: `nearestRankPercentile` in `src/metrics/stats.ts`.

---

## 7. Schema Sketch (`metrics` section of RunArtifact)

```json
{
  "aggregates": [
    {
      "cellId": "pm-pnpm__runner-native",
      "stageId": "install",
      "metric": "durationMs",
      "unit": "ms",
      "stats": {
        "count": 3,
        "min": 12000,
        "max": 14000,
        "mean": 13000,
        "median": 12900,
        "p95": 13900,
        "stdev": 1000
      }
    }
  ]
}
```

JSON Schema versioning: `metricsSchemaVersion` integer on the artifact.

---

## 8. Clock & Precision Rules

- Prefer monotonic clocks for durations.
- Round displayed values in Markdown; keep full precision in JSON.
- Record `timingSource: node-hrtime | performance-now | date-fallback`.

---

## 9. Outliers

Default: **no automatic outlier removal**.

Opt-in (S21): set `metrics.outlierRule: iqr` on a profile to apply Tukey fences (1.5×IQR) using nearest-rank Q1/Q3 before primary aggregates.

- Groups with fewer than **4** measured samples are left unchanged (noted in `warnings`).
- Dropped samples are listed in `run.json` under `outlierFilter.dropped` (iteration, value, fences, reason) and summarized in `warnings`.
- Raw `results[]` are never rewritten — only aggregates exclude dropped values.
- If filtering would remove every sample in a group, all values are kept and a warning is recorded.

```yaml
metrics:
  collectors: [wall]
  outlierRule: iqr
```

---

## 10. Performance Budget

Collectors must not dominate short stages. Guidelines:

- `wall`: negligible
- `rusage`: negligible
- `docker-stats` interval ≥ 200ms
- Avoid per-file hashing during timed stages

---

## 11. Validation

- Reject negative durations
- Reject unknown units
- Fail schema validation in CI for fixture artifacts

---

## 12. Related Documents

- Reporting consumes aggregates: [08_REPORTING.md](08_REPORTING.md)
- Native collection notes: [05_NATIVE_BENCHMARK.md](05_NATIVE_BENCHMARK.md)
- Docker stats: [06_DOCKER_BENCHMARK.md](06_DOCKER_BENCHMARK.md)
