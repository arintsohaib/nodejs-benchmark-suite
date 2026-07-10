# Reporting Engine

**Status:** Complete for v1 Markdown/HTML/diff (S14)  
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

Markdown and HTML include a **Citation** section with a prefilled blurb (no winner claims).

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

---

## 14. Related Documents

- Metrics: [07_METRICS_ENGINE.md](07_METRICS_ENGINE.md)
- Architecture: [03_ARCHITECTURE.md](03_ARCHITECTURE.md)
- Implementation: [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md) S7, S14
