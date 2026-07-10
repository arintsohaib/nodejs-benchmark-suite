# Release Candidate Checklist — `1.1.0-rc.1`

**Suite version:** `1.1.0-rc.1`  
**Date:** 2026-07-11  
**Status:** Prepared in-tree (no git tag / no npm publish in this step)  
**Companion:** [20_HARDWARE_VALIDATION_PLAN.md](20_HARDWARE_VALIDATION_PLAN.md) · [14_CHANGELOG.md](14_CHANGELOG.md)

Use this checklist before inviting external testers and again before cutting final `1.1.0`.

---

## 1. Completed work in this candidate

| Area | Included |
|------|----------|
| Post-1.0 slices S19–S26 | Regression gate, replay, IQR outliers, leaderboard, Tailwind + workspace templates, docker-stats collector, official profile tiers |
| Template fix | `node-ts-lib` / `fixture-lib` `export *` so `install-build-matrix` builds |
| Release polish | Linux onboarding docs, doctor UX, `pnpm jsbench` invocation consistency, list table, log tails |
| Schema | Still **schemaVersion / metricsSchemaVersion = 1** (additive 1.x) |

---

## 2. Version & docs gate

- [x] `package.json` version = `1.1.0-rc.1`
- [x] `SUITE_VERSION` reads from `package.json`
- [x] Changelog section `[1.1.0-rc.1]`
- [x] README / AGENTS / TASKS / ROADMAP reflect RC status
- [x] Schema compatibility doc notes 1.x window still applies
- [x] MIT `LICENSE` present
- [ ] Git tag `v1.1.0-rc.1` (maintainer; **not** created in prep)
- [ ] GitHub Release notes published (maintainer)
- [ ] npm publish (optional; maintainer)

---

## 3. Known limitations

| Limitation | Impact |
|------------|--------|
| Linux-first | Windows / macOS runners not supported as first-class |
| No global `jsbench` from a plain clone | Use `pnpm jsbench` or `node dist/cli.js` after build |
| `docker-stats` | Implemented; no official built-in profile enables it yet |
| `*-benchmark-slow` | Lab-only; Yarn cells need Yarn on PATH; long runtime |
| Pin files | `templates/resolved-versions.json` / Docker pins still labeled calibrated for `1.0.0` (content unchanged for RC) |
| Result upload | Not in scope; leaderboard is local-first only |
| Uncommitted history | Prep may land on a branch with uncommitted S19–S26+polish until maintainers commit |

---

## 4. Supported platforms (RC)

| Platform | Support |
|----------|---------|
| Native **Linux** (x86_64), Node.js ≥ 20 | **Supported** (primary) |
| Docker Engine on Linux | **Supported** (`docker-smoke` and Docker profiles) |
| pnpm + npm on PATH | **Supported** (required for most official profiles) |
| Yarn Berry on PATH | **Optional** (slow-tier Yarn cells) |

---

## 5. Unsupported / out of scope (RC)

| Platform / feature | Status |
|--------------------|--------|
| Windows native runner | Unsupported |
| macOS native runner | Unsupported |
| HTTP load / Lighthouse / CWV | Out of scope |
| Crowning “winners” in reports | Explicitly forbidden |
| Cloud result upload | Not implemented |

---

## 6. Testing performed (prep environment)

| Check | Result |
|-------|--------|
| `pnpm format` / `lint` / `typecheck` / `test` (137) / `build` | **Pass** (2026-07-11 prep host) |
| CLI: `version` → `1.1.0-rc.1`, `help`, `doctor`, `list-profiles` | **Pass** |
| Validate all 13 built-in profiles | **Pass** |
| `native-smoke` execute | **Pass** |
| `install-build-matrix` full run | **Pass** |
| `report` + `report diff` + `replay --execute` | **Pass** |
| `docker-smoke` | **Pass** (Docker available on prep host) |
| `run.json` `suiteVersion` | **`1.1.0-rc.1`** |
| Full `*-benchmark` / `*-benchmark-slow` matrix | Deferred to [20_HARDWARE_VALIDATION_PLAN.md](20_HARDWARE_VALIDATION_PLAN.md) |

---

## 7. Testing still recommended before final `1.1.0`

1. Execute [20_HARDWARE_VALIDATION_PLAN.md](20_HARDWARE_VALIDATION_PLAN.md) on ≥3 hardware classes.
2. Cold-boot first-time install on a clean Debian/Ubuntu VM (Node 20+, rootless Corepack).
3. Optional: `JSBENCH_SLOW_TESTS=1 pnpm test:slow` with npm+pnpm on PATH.
4. Optional: one `*-benchmark-slow` profile on a lab machine with Yarn.
5. Confirm CI green on the commit that will be tagged.
6. Diff `run.json` schema against `schemas/run-artifact.schema.json` for a fresh Next.js benchmark run.
7. Re-read methodology section in README before any public citation of RC numbers.

---

## 8. Maintainer release steps (after approval)

1. Commit all RC preparation changes on the release branch.
2. Ensure CI is green.
3. `git tag -a v1.1.0-rc.1 -m "1.1.0-rc.1"` (only when approved).
4. Push branch + tag; open GitHub Release marked **pre-release**.
5. Invite external testers with links to this checklist and the hardware plan.
6. After hardware feedback, bump to `1.1.0`, move notes from Unreleased, tag `v1.1.0`.
