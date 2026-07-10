# Task Tracking

**Status:** S24 complete (`pnpm-workspace`); suite `1.0.0` — further post-1.0 via parking lot  
**Last updated:** July 2026  
**How to use:** Move items across status sections; reference task ids in commits/PRs.  
**Engineering sequence:** Prefer slices **S1–S18** in [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md) for commit boundaries.  
**AI agents:** follow [../AGENTS.md](../AGENTS.md) (one slice per turn; stop for review).

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `todo` | Not started |
| `doing` | Active |
| `blocked` | Waiting on decision/dependency |
| `done` | Complete |

---

## M0 — Planning

| ID | Task | Status |
|----|------|--------|
| T-M0-01 | Author project overview and goals | done |
| T-M0-02 | Author requirements and architecture | done |
| T-M0-03 | Author generator / native / docker specs | done |
| T-M0-04 | Author metrics and reporting specs | done |
| T-M0-05 | Author version, coding, dependency policies | done |
| T-M0-06 | Author roadmap, tasks, FAQ, contributing, changelog | done |
| T-M0-07 | Write README for planning phase | done |
| T-M0-08 | Add MIT LICENSE | done |
| T-M0-09 | Review docs for internal consistency | done |

---

## Foundation — S1–S3 (tooling + config + profiles)

| ID | Task | Status |
|----|------|--------|
| T-M1-01 | Choose suite package manager + workspace layout (`packages/` vs single `src/`) | done |
| T-M1-02 | Initialize TypeScript project, lint/format, test runner | done |
| T-M1-03 | Implement profile JSON Schema + loader/validator | done |
| T-M1-04 | Implement config precedence (CLI/env/file/defaults) | done |
| T-FND-01 | Errors, logging, DI composition root, public interfaces | done |
| T-FND-02 | CI workflow + foundation sample profile | done |
| T-FND-03 | Foundation audit fixes (imports, Ajv, test runner, docs sync) | done |

---

## M1 — Native MVP (remaining)

| ID | Task | Status |
|----|------|--------|
| T-M1-05 | Implement `RunPlan` expansion (without full matrix) | done (S4) |
| T-M1-06 | Implement native process runner + timeouts | done (S6) |
| T-M1-07 | Implement `wall` collector + aggregations | done (S5) |
| T-M1-08 | Persist `run.json` + Markdown reporter | done (S7) |
| T-M1-09 | Implement CLI: `doctor`, `run` execution (`run --dry-run` done in S4) | done (S8) |
| T-M1-10 | Add `native-smoke` profile (minimal fixture) | done (S9) |
| T-M1-11 | Expand CI for M1 smoke (foundation CI done) | done (S9) |
| T-M1-12 | Document M1 usage in README | done (S9) |

---

## M2 — Generator & Matrices

| ID | Task | Status |
|----|------|--------|
| T-M2-01 | Template manifest format + loader | done (S10) |
| T-M2-02 | Implement `node-ts-lib` template | done (S11) |
| T-M2-03 | Implement `nextjs-app` template | done (S11) |
| T-M2-04 | Size presets + seed determinism | done (S10) |
| T-M2-05 | Content digest algorithm + tests | done (S10) |
| T-M2-06 | Package manager adapters: npm, pnpm, Yarn | done (S12) |
| T-M2-07 | Matrix expansion in planner | done (S12) |
| T-M2-08 | Run-scoped cache directories for cold installs | done (S12) |
| T-M2-09 | Version resolver hooks for fixture pins | done (S11) |
| T-M2-10 | Built-in profile: install+build matrix | done (S12) |

---

## M3 — Docker

| ID | Task | Status |
|----|------|--------|
| T-M3-01 | Docker availability checks in `doctor` | done (S13) |
| T-M3-02 | Image policy resolver | done (S13) |
| T-M3-03 | Mount planner: bind + named-volume | done (S13) |
| T-M3-04 | Container lifecycle + `exec` timing | done (S13) |
| T-M3-05 | Resource limit flags + fingerprint fields | done (S13) |
| T-M3-06 | Cleanup policies | done (S13) |
| T-M3-07 | `docker-smoke` profile | done (S13) |
| T-M3-08 | Optional CI workflow for Docker smoke | done (S13) |
| T-M3-09 | Docs: native vs Docker comparability checklist (verify against runs) | done (S13) |

---

## M4 — Reporting UX

| ID | Task | Status |
|----|------|--------|
| T-M4-01 | HTML reporter (self-contained) | done (S14) |
| T-M4-02 | `jsbench report` re-render command | done (S14) |
| T-M4-03 | `jsbench report diff` | done (S14) |
| T-M4-04 | Citation block + publishing guidelines in output | done (S14) |
| T-M4-05 | Log truncation + partial failure reports | done (S14) |
| T-M4-06 | Golden tests for Markdown/HTML | done (S14) |

---

## M5 — Extensibility & Hardening

| ID | Task | Status |
|----|------|--------|
| T-M5-01 | Plugin API for collectors/reporters | done (S15) |
| T-M5-02 | `rusage` collector | done (S15) |
| T-M5-03 | `disk-usage` collector | done (S15) |
| T-M5-04 | Sample external plugin documentation | done (S15) |
| T-M5-05 | Security pass: shell forbid, mount allowlists | done (S16) |
| T-M5-06 | Orchestration overhead measurement | done (S16) |
| T-M5-07 | Additional templates (Tailwind / workspace) as capacity allows | done (S23 Tailwind + S24 `pnpm-workspace`) |

---

## M6 — Public 1.0

| ID | Task | Status |
|----|------|--------|
| T-M6-01 | Freeze schema v1 compatibility statement | done (S18 freeze; draft in S17) |
| T-M6-02 | Calibrate built-in profiles + pin fixtures | done (S17) |
| T-M6-03 | Full tutorial polish in README | done (S17) |
| T-M6-04 | Release `1.0.0` + changelog entry | done (S18) |
| T-M6-05 | Tag and publish package (if npm publish desired) | done (tag `v1.0.0`; npm publish deferred — optional) |

---

## Post-1.0

| ID | Task | Status |
|----|------|--------|
| T-POST-01 | CI regression gates via `report diff` thresholds | done (S19) |
| T-POST-02 | `replay` from historical `run.json` | done (S20) |
| T-POST-03 | Opt-in statistical outlier rules (`outlierRule: iqr`) | done (S21) |
| T-POST-04 | Optional local-first leaderboard result directory | done (S22) |

---

## Decisions Log

Record architecture choices here as they are made during implementation:

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-11 | Planning-only phase; no implementation yet | Spec-first project start |
| 2026-07-11 | Suite package manager: **pnpm** | Locked in implementation plan; independent of pms under test |
| 2026-07-11 | Layout M1–M3: **single package `src/`** | Simpler vertical slices; extract monorepo later if needed |
| 2026-07-11 | CLI name: **`jsbench`** | Consistent with specs |
| 2026-07-11 | Tooling: Biome + `node:test` + `tsx`; emit `dist/` | Minimal dependency policy fit |
| 2026-07-11 | Files: `kebab-case.ts`; tests colocated `*.test.ts` | Coding-standard kickoff choice |
| 2026-07-11 | Drop `ajv-formats` until schemas need `format` keywords | Avoids ESM/default-import friction; leaner deps |
| 2026-07-11 | Foundation S1–S3 marked complete | Tooling + config + profile validation green |
| 2026-07-11 | S4 single-cell planner + `run --dry-run` | Multi-cell matrices deferred to M2/S12 |
| 2026-07-11 | S5 p95 = **nearest-rank**; wall uses `process.hrtime.bigint` | Deterministic aggregates; monotonic clock |
| 2026-07-11 | S6 native spawn: scrubbed env allowlist; proxies opt-in; `shell: false` | Isolation + no shell injection on default path |
| 2026-07-11 | S7 RunArtifact `schemaVersion`/`metricsSchemaVersion` = **1** | Locked public contract for `run.json` |
| 2026-07-11 | S8 executable action: **`raw.command`** (+ `command`/`args`); `node`→`execPath` | M1 without pm adapters; adapters later |
| 2026-07-11 | S9: profile **id** resolution + static fixture seed via `workload.template` dir | Enables `run --profile native-smoke` |
| 2026-07-11 | S10 generator: custom TS render (no Handlebars); digest excludes `.jsbench-workspace.json` | Lean deps; stamp after hash |
| 2026-07-11 | S11: offline pins in `templates/resolved-versions.json`; default materialize uses pin resolver | Deterministic CI without registry; refresh pins deliberately |
| 2026-07-11 | S12: Yarn Berry default (`yarn` axis); Classic deferred; run-scoped caches under `_caches/<cellId>/` | Matches version policy; avoids home-cache pollution |
| 2026-07-11 | S13: Docker CLI runner; image pins in `docker/resolved-images.json`; timed `docker exec` only | Prefer CLI simplicity; pull/create untimed per §9 |
| 2026-07-11 | S14: HTML + `report`/`report diff`; citation in Markdown/HTML; default write `index.html` | M4 shareable artifacts; re-render does not mutate `run.json` |
| 2026-07-11 | S15: in-process plugins via config `plugins[]`; `rusage`/`disk-usage` best-effort; wall stays process-timed | Extensibility without core edits; child rusage deferred |
| 2026-07-11 | S16: shell forbid audit; Docker mount allowlist under workspaceRoot; NFR-03 overhead helper; templates deferred | M5 exit without optional template scope creep |
| 2026-07-11 | S17: calibrated digests + pin metadata; schema compatibility draft; README methodology; dry-run all built-ins | Publishable profile baseline before 1.0 tag |
| 2026-07-11 | S18: suite `1.0.0`; freeze schema compatibility; changelog release; tag `v1.0.0`; skip optional npm publish | M6 exit; publish when maintainers choose |
| 2026-07-11 | S19: `report diff --fail-on-regression` + exit 7; deterministic CI fixture gate | Post-1.0 methodology gate without flaky live timing |
| 2026-07-11 | S20: `jsbench replay` hints + `--execute` with profile digest check | Automate reproduction path from version policy §6 |
| 2026-07-11 | S21: opt-in `metrics.outlierRule: iqr`; explicit `outlierFilter` + warnings; never silent | Methodology honesty; matches metrics §9 |
| 2026-07-11 | S22: local `jsbench leaderboard` index; no upload; entries by runId not performance | Community share format without crowning winners |
| 2026-07-11 | S23: `nextjs-app-tailwind` (Tailwind v4 PostCSS); defer `pnpm-workspace` | Expand install/build realism; one template per slice |
| 2026-07-11 | Post-S23 gate: home h1 = `jsbench-<templateId>` in application renderer | Fixes Tailwind label mismatch without changing `nextjs-app` digest |
| 2026-07-11 | S24: `pnpm-workspace` (`kind: workspace`); pin walk for packages/*; complete T-M5-07 | Multi-package install/build realism on Linux |
| 2026-07-11 | Post-S24 gate: approve S24; reject `packageCount < 1` in workspace renderer | Quality gate after human approval |

---

## Parking Lot

- Windows/macOS runners
- Result *upload* (local leaderboard format done — S22)
- Compose multi-service fixtures
- Optional built-in profiles for `nextjs-app-tailwind` / `pnpm-workspace` matrices
- `docker-stats` collector (metrics §5.4)

### Recorded risks / recommendations (post-1.0)

| Item | Notes |
|------|-------|
| S22 leaderboard | Discovery depth capped; empty indexes valid; sharing is manual (no upload) |
| S23 Tailwind | No profile yet; no `next build` in CI; refresh pins carefully and re-baseline digests |
| S24 workspace | pnpm-oriented; no recursive install in default CI; `workspace:*` edges are sequential |
| Next suggested | **`docker-stats` collector** (methodology), or optional profiles for new templates; Compose / OS runners lower priority |
