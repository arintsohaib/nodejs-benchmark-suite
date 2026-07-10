# Reporting Engine

**Status:** Complete for v1 Markdown/HTML/diff (S14); regression gate (S19); local leaderboard (S22)  
**Last updated:** July 2026  
**Owner:** Reporting maintainers

---

## 1. Purpose

The reporting engine turns raw run data into durable, shareable artifacts:

- Machine-readable JSON (source of truth)
- Human Markdown summaries
- Static HTML overview
- Diffs between two runs

Reports must make methodology visible: profile digest, environment, cold/warm, mount mode, iterations.

---

## 2. Artifact Layout

```
reports/
  <run-id>/
    manifest.json          # run identity, status, pointers
    run.json               # full RunArtifact (source of truth)
    summary.md             # Markdown report
    index.html             # self-contained HTML
    logs/                  # stage logs (orchestration S8+)
    meta/
      profile.resolved.yaml
      environment.json
```

`run-id` format (recommended): `YYYYMMDDThhmmssZ-<short-uuid>` (see `createRunId`).

Library API: `writeRunArtifact(artifact, outDir)` writes `manifest.json`, `run.json`, `summary.md`, and `index.html` by default.

`jsbench report diff` writes `diff.md` + `diff.json` under `--out` (default `diff-<left>-vs-<right>/`).

`jsbench leaderboard` writes a **local-first** community index (`leaderboard.json` + `leaderboard.md`) under `--out` (default `./leaderboard`). It does **not** upload results and does **not** rank winners. Schema: `schemas/leaderboard.schema.json`.

---

## 3. `run.json` Contract

Required top-level fields (JSON Schema: `schemas/run-artifact.schema.json`):

- `suiteVersion`
- `schemaVersion` (**1** — locked)
- `metricsSchemaVersion` (**1** — locked)
- `runId`
- `createdAt` / `finishedAt`
- `status` (`completed` | `failed` | `partial`)
- `profile` `{ id, digest, path }`
- `environment` fingerprint
- `plan` summary (cells, stages, iterations)
- `results` array of stage results
- `aggregates` array
- `warnings` array
- optional `outlierFilter` when `metrics.outlierRule: iqr` dropped samples (S21)

This file is immutable once finalized. Re-rendering reports must not alter `run.json`.

Validate with `assertValidRunArtifact` / `isValidRunArtifact`.

### Status derivation

`deriveRunStatus(results)`:

| Condition | Status |
|-----------|--------|
| No `failed` stages | `completed` |
| Mix of `passed` and `failed` | `partial` |
| Empty or only failures | `failed` |

---

## 4. Markdown Summary Structure

Implemented by `renderMarkdownSummary` / `MarkdownReporter` → `summary.md`.

```markdown
# Benchmark Report — <run-id>

> **Partial run** / **Failed run** banner when status ≠ completed

## Snapshot
- Suite / status / profile id + digest
- Runner mode / iterations / cells / stages

## Environment
- OS, CPU, RAM, arch
- Node + package managers

## Results
### Stage: <id>
| Cell | median ms | mean ms | p95 ms | n |
...

### Failed stages
- …

## Notes / Warnings
- …

## Citation
- Prefill suite/run/profile/mode + methodology reminders
```

Tone: factual. No “winner” banners. Duration tables use `durationMs` aggregates only. Long warnings are truncated for display.

---

## 5. HTML Report

v1 HTML (S14):

- Single self-contained `index.html` (inline CSS) for easy sharing
- Tables mirroring Markdown
- Simple CSS bar charts (no chart SaaS, no heavy UI framework)

Out of scope for v1: interactive SPAs, server-side dashboards.

---

## 6. Diff Reports

`jsbench report diff <runA> <runB>`:

- Join on `(stageId, metric, cellId)` — cell ids already normalize axis order
- Absolute and percent delta on median
- Flag missing cells on either side (`presence`: `both` | `left-only` | `right-only`)
- Emit `diff.md` + `diff.json`

### Regression gate (S19)

Optional CI-oriented thresholds on the same diff:

```bash
jsbench report diff baseline/ current/ \
  --metric durationMs \
  --fail-on-regression \
  --max-percent-increase 10 \
  --max-absolute-increase 50 \
  --require-same-profile-digest
```

| Flag | Role |
|------|------|
| `--fail-on-regression` | Enable gate; exit **7** when violated |
| `--max-percent-increase <n>` | Max allowed median % increase (right vs left) |
| `--max-absolute-increase <n>` | Max allowed median absolute increase |
| `--metric <name>` | Limit diff + gate to one metric (e.g. `durationMs`) |
| `--no-fail-on-missing` | Do not fail on left-only / right-only rows |
| `--require-same-profile-digest` | Fail when profile digests differ |

At least one of `--max-percent-increase` / `--max-absolute-increase` is required with `--fail-on-regression`. Violations are included in the JSON stdout under `gate`. Prefer comparing a checked-in baseline `run.json` to a fresh run (or two fixtures) rather than two live noisy runs without generous thresholds.

---

## 7. Aggregation Views

Reporting may pivot aggregates by:

- Package manager
- Runner (`native` vs `docker`)
- Mount mode
- Size preset

Pivots are views—do not invent metrics not present in `run.json`.

---

## 8. Publishing Guidelines (for humans)

When publishing results externally, include:

1. Suite version and git commit
2. Profile id + digest
3. Hardware summary
4. Full `run.json` or link to it
5. Statement of cold/warm and network policy

Markdown and HTML include a **Citation** section with a prefilled blurb (no winner claims). Snapshots also show **Profile tier** (`smoke` / `benchmark` / `benchmark-slow` / custom) derived from the profile id.

---

## 9. Reporter Interface

```typescript
interface Reporter {
  id: string;
  render(artifact: RunArtifact, outDir: string): Promise<void>;
}
```

Built-ins: `json` (written by `writeRunArtifact`), `markdown`, `html`.  
`jsbench report <runDir>` re-renders Markdown + HTML from existing `run.json` without mutating it.  
Plugins may add `csv`, `junit` (for CI gates on regressions), etc. (S15+).

---

## 10. Failure Reporting

If a run fails mid-flight:

- Persist `run.json` with `status: failed|partial`
- Include completed results
- Markdown/HTML show a partial/failed banner and failed stages
- Exit code remains non-zero

---

## 11. Privacy

Reporters must apply the same env redaction rules as the engine before embedding environment snapshots in HTML/Markdown. Fingerprints use toolchain discovery paths/versions only—not full process env.

---

## 12. Environment Fingerprint

`collectEnvironmentFingerprint` (best-effort):

- OS platform/release + `/etc/os-release` distro when available
- CPU model, logical cores, arch
- Total memory bytes
- Optional workspace path
- Toolchains via `discoverNativeToolchains` (or injected for tests)

---

## 13. Testing

- Golden-file tests for Markdown/HTML given a fixture `run.json` (`src/reporting/fixtures/`)
- Schema validation of `run.json` fixtures
- Diff tests with known deltas (`sample-diff.golden.md` / `.json`)
- Regression gate unit + CLI tests (`evaluateRegressionGate`, exit code 7)
- Leaderboard builder + CLI tests (`buildLeaderboard`, `jsbench leaderboard`)

---

## 14. Related Documents

- Metrics: [07_METRICS_ENGINE.md](07_METRICS_ENGINE.md)
- Architecture: [03_ARCHITECTURE.md](03_ARCHITECTURE.md)
- Implementation: [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md) S7, S14, S19, S22
- Schema: [schemas/leaderboard.schema.json](../schemas/leaderboard.schema.json)