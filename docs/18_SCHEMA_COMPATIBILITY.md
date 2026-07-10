# Schema Compatibility (v1)

**Status:** Frozen for suite `1.0.0` (S18)  
**Last updated:** July 2026  
**Companion:** [09_VERSION_POLICY.md](09_VERSION_POLICY.md) · [08_REPORTING.md](08_REPORTING.md)

---

## 1. Purpose

This statement describes the **compatibility window** for public JSON contracts in suite **`1.0.0`**. Breaking changes to these contracts require a suite **MAJOR** bump and a new schema compatibility revision.

---

## 2. Locked integers (v1)

| Contract | Field | Value | Notes |
|----------|-------|------:|-------|
| Benchmark profile | `schemaVersion` | **1** | `schemas/profile.schema.json` |
| Run artifact | `schemaVersion` | **1** | `schemas/run-artifact.schema.json` |
| Run artifact | `metricsSchemaVersion` | **1** | Aggregation / metric naming |
| Suite config | (implicit) | — | `schemas/jsbench-config.schema.json` (no integer yet) |
| Template manifest | (implicit) | — | `schemas/template-manifest.schema.json` |

Constants in code: `RUN_ARTIFACT_SCHEMA_VERSION`, `METRICS_SCHEMA_VERSION` in `src/reporting/constants.ts`.

---

## 3. Compatibility promise (1.0)

Within suite major version **1.x** that advertises these integers as `1`:

1. **Readers** of `run.json` may rely on required fields documented in [08_REPORTING.md](08_REPORTING.md) §3.
2. **Writers** (this suite) may add **optional** properties without bumping `schemaVersion`.
3. **Removing or renaming** required fields, or changing metric semantics for existing names, requires a **schemaVersion** (and suite **MAJOR**) bump.
4. Profile `schemaVersion: 1` documents remain loadable; new optional profile keys may appear in minor releases (e.g. `metrics.outlierRule`).
5. Built-in profile **ids** (`native-smoke`, `install-build-matrix`, `docker-smoke`) are stable; removal requires an alias period announced in the changelog.
6. Optional run-artifact fields (e.g. `outlierFilter`) may appear without bumping `schemaVersion`.

---

## 4. What is *not* covered

- Fixture / template **content digests** (change when pins or skeletons change; see `profiles/calibrated-digests.json`)
- Floating `policy:*` resolutions outside the offline pin files
- Plugin reporter/collector shapes beyond the documented `Collector` / `Reporter` interfaces
- Docker image digests recorded at run time (best-effort fingerprint fields)

---

## 5. Calibration artifacts

| Artifact | Role |
|----------|------|
| `templates/resolved-versions.json` | Offline `policy:*` package pins |
| `docker/resolved-images.json` | Offline `imagePolicy` pins |
| `profiles/calibrated-digests.json` | Expected profile + tiny template digests |

Re-baseline digests deliberately when pins or built-in profiles change; record the reason in [14_CHANGELOG.md](14_CHANGELOG.md).

---

## 6. Related documents

- Version policy: [09_VERSION_POLICY.md](09_VERSION_POLICY.md)
- Implementation plan S17–S18: [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md)
- Tasks T-M6-01..05: [13_TASKS.md](13_TASKS.md)
