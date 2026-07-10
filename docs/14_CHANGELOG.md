# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

Suite versioning rules: [09_VERSION_POLICY.md](09_VERSION_POLICY.md).  
Schema compatibility: [18_SCHEMA_COMPATIBILITY.md](18_SCHEMA_COMPATIBILITY.md).

---

## [Unreleased]

### Added

- **S19:** `jsbench report diff --fail-on-regression` with `--max-percent-increase` / `--max-absolute-increase` (exit code **7**); `evaluateRegressionGate`; deterministic CI fixture gate smoke.
- **S20:** `jsbench replay <runDir|--from path>` reproduction hints (`exact:` toolchain pins); `--execute` re-runs when profile digest matches (`--force` to override).
- **S21:** Opt-in `metrics.outlierRule: iqr` (Tukey fences); `outlierFilter.dropped` in `run.json` + warnings; raw results unchanged.
- **S22:** `jsbench leaderboard` writes local-first `leaderboard.json` + `leaderboard.md` (`schemas/leaderboard.schema.json`); no upload; no winner rankings.
- **S23:** Template `nextjs-app-tailwind` (Tailwind CSS v4 + PostCSS); pins in `resolved-versions.json`; tiny digest calibrated.

### Changed

- Architecture exit-code table documents code 7 (regression gate).
- Version policy §6 documents `replay` instead of “may later add”.
- Metrics §9 documents opt-in IQR (no longer “optional later”).
- FR-CLI-02 / reporting docs include `leaderboard`.
- Generator template table marks `nextjs-app-tailwind` done; `pnpm-workspace` remains deferred.
- Application renderer home title uses `jsbench-<templateId>` (post-S23 quality gate; `nextjs-app` digest unchanged).

---

## [1.0.0] — 2026-07-11

First stable public release (M6 exit / S18). Schema v1 compatibility is frozen; built-in profiles are calibrated.

### Added

- Foundation TypeScript suite (`src/`): CLI skeleton, config loader, profile loader/validator, errors, logging, DI container, metrics/reporting/engine interfaces.
- JSON Schemas for `jsbench` config and benchmark profiles under `schemas/`.
- Sample profile `profiles/foundation-sample.yaml`.
- Biome lint/format, strict `tsconfig`, pnpm lockfile, GitHub Actions CI.
- Example config `jsbench.config.example.yaml`.
- Repository-level [AGENTS.md](../AGENTS.md) operating manual for AI agents (reading order, one-milestone workflow, Definition of Done).
- Complete planning-phase documentation set under `docs/` (overview through schema compatibility).
- MIT `LICENSE`.
- **S4:** Single-cell `RunPlan` planner (`createRunPlan`), matrix expansion with multi-cell rejection, and `jsbench run --profile <path> --dry-run` JSON output.
- **S5:** `wall` collector (`process.hrtime.bigint` → `durationMs`), pure aggregations (count/min/max/mean/median/p95/stdev), nearest-rank p95 locked.
- **S6:** Native `runProcess` (argv spawn, scrubbed env, log capture, process-group timeout kill) + `discoverNativeToolchains` (Node/npm).
- **S7:** `writeRunArtifact` (`manifest.json` + `run.json` + `summary.md`), environment fingerprint, Markdown reporter, RunArtifact JSON Schema v1.
- **S8:** CLI `doctor` + `run` execution for `raw.command` stages; engine orchestration; `--continue-on-error`; CI smoke run.
- **S9:** Official `native-smoke` profile + `fixtures/native-smoke/`; profile id resolution; README M1 usage; CI verify uses `native-smoke`; optional `workflow_dispatch` job. **M1 exit.**
- **S10:** Generator core — template manifest loader, size expansion, materialize + content digest, `jsbench generate`, `templates/fixture-lib`.
- **S11:** Templates `node-ts-lib` + `nextjs-app` (`tiny`–`large`); offline pin resolver (`templates/resolved-versions.json`); tiny snapshot/digest tests (no `next build` in CI).
- **S12 / M2 exit:** npm/pnpm/Yarn Berry adapters; full cartesian matrix; run-scoped caches + cold `node_modules` policy; `list-profiles`; `install-build-matrix` profile; `run` materializes template ids; optional `pnpm test:slow`.
- **S13 / M3 exit:** Docker CLI runner (`bind` + `named-volume`); image policy pins; timed `docker exec`; `docker-smoke` profile; doctor Docker check; optional CI `docker_smoke` job.
- **S14 / M4 exit:** Self-contained HTML reporter (`index.html`); `jsbench report` re-render; `jsbench report diff` (`diff.md` + `diff.json`); Citation section; warning/log truncation; partial/failed banners; golden Markdown/HTML/diff fixtures.
- **S15 / M5 start:** In-process plugin loader (`config.plugins`); built-in `rusage` + `disk-usage` collectors; sample reporter at `examples/plugins/sample-note-reporter.mjs`; aggregates all stage metrics.
- **S16 / M5 exit:** Shell-forbid audit + reject `shell`/`unsafe.shell` actions; Docker host mount allowlist (workspace root only; forbid `$HOME` / system paths); orchestration overhead helper for NFR-03.
- **S17 / M6 start:** Calibrated digests (`profiles/calibrated-digests.json`); pin metadata on template/Docker pin files; schema compatibility statement; README methodology + official profile table; dry-run tests for all built-in profiles; built-in profiles request HTML reports.
- **S18 / M6 exit:** Suite `1.0.0`; frozen [18_SCHEMA_COMPATIBILITY.md](18_SCHEMA_COMPATIBILITY.md); git tag `v1.0.0`.

### Changed

- README reflects shipped 1.0 status (no longer planning-only).
- Removed unused `ajv-formats` dependency (schemas do not use `format` keywords).
- Aligned milestone success criteria for phased delivery (M1 native-only; matrices in M2; Docker in M3).
- Default `materialize` resolves `policy:*` deps via offline pins (S11); identity resolver remains available for tests.
- `writeRunArtifact` also writes `index.html` by default (alongside Markdown).
- Stage aggregation includes all metrics from collectors (not only `durationMs`).
- Template tiny snapshot digests sourced from `profiles/calibrated-digests.json`.
- Suite version set to `1.0.0` (stable).

### Notes

- **Resolved at foundation kickoff:** Node `engines` `>=20`; CI Node 22 (Active LTS line at authoring time). Suite package manager: pnpm. Lint/format: Biome.
- **M0–M6 complete.** npm publish was optional for S18 and was not performed in-repo; maintainers may publish from the `v1.0.0` tag when ready.

---

## [0.0.0] — 2026-07-11

### Added

- Project initialized in planning state.
