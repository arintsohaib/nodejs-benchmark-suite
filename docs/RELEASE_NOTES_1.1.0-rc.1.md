# Release notes — `1.1.0-rc.1`

**Pre-release** of the Node.js Benchmark Suite for external and hardware testing.

**Do not** treat numbers from this RC as final `1.1.0` citations until the stable tag ships.

## Highlights

- Post-1.0 features: regression gates (`report diff --fail-on-regression`), `replay`, opt-in IQR outliers, local `leaderboard`, Tailwind + pnpm-workspace templates, `docker-stats` collector, official smoke/benchmark/slow profiles.
- Release polish: Linux first-time setup, clearer `doctor`, consistent `pnpm jsbench` invocation.
- Bugfix: `node-ts-lib` build export so `install-build-matrix` succeeds.

## Install (Linux)

See README **First-time setup (Linux)** — Node.js ≥ 20, pnpm on PATH via rootless Corepack, then:

```bash
pnpm install
pnpm jsbench doctor
pnpm jsbench run --profile native-smoke
```

## Compatibility

Public JSON contracts remain **schemaVersion 1** / **metricsSchemaVersion 1** (suite 1.x window). See `docs/18_SCHEMA_COMPATIBILITY.md`.

## Testing

- Checklist: `docs/19_RELEASE_CANDIDATE_CHECKLIST.md`
- Hardware plan: `docs/20_HARDWARE_VALIDATION_PLAN.md`
- Full changelog: `docs/14_CHANGELOG.md` → `[1.1.0-rc.1]`

## Not in this RC

- Git tag / npm publish (maintainer steps after approval)
- Windows / macOS first-class runners
- Result upload
- Final `1.1.0` stable cut
