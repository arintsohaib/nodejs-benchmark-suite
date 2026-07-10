# Node.js Benchmark Suite

Open-source **engineering benchmark platform** for measuring modern JavaScript *development* performance.

Compare developer-loop cost across hardware, storage, operating systems, Docker setups, package managers, and project sizes—on **native Linux** and in **Docker**.

**Status:** **`1.1.0-rc.1`** release candidate (M0–M6 + S19–S26 + release polish)  
**Suite version:** `1.1.0-rc.1` (previous stable tag: `v1.0.0`)  
**RC docs:** [19_RELEASE_CANDIDATE_CHECKLIST.md](docs/19_RELEASE_CANDIDATE_CHECKLIST.md) · [20_HARDWARE_VALIDATION_PLAN.md](docs/20_HARDWARE_VALIDATION_PLAN.md)

**AI agents:** follow [AGENTS.md](AGENTS.md) (required reading and milestone workflow).

---

## First-time setup (Linux)

**Requirements**

| Tool | Required? | Notes |
|------|-----------|--------|
| **Node.js ≥ 20** | Yes | Active LTS recommended. System Node 18 will fail `doctor`. |
| **pnpm** (via Corepack) | Yes for this repo + most profiles | Must be on your `PATH` |
| **npm** | For npm matrix cells | Usually ships with Node |
| **Yarn** | Optional | Only `*-benchmark-slow` Yarn cells |
| **Docker** | Optional | Only Docker profiles (e.g. `docker-smoke`) |

**Install pnpm without root** (recommended when `corepack enable` cannot write to `/usr/local/bin`):

```bash
mkdir -p "$HOME/.local/bin"
corepack enable --install-directory "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
corepack prepare pnpm@10.12.4 --activate
# Add the export to ~/.bashrc (or equivalent) so new shells keep pnpm on PATH.
```

**Clone and first run**

```bash
git clone <repo-url>
cd nodejs-benchmark-suite
pnpm install

# Recommended CLI form from a clone (tsx; no build required):
pnpm jsbench doctor
pnpm jsbench list-profiles
pnpm jsbench run --profile native-smoke

# Equivalent after a production-like build:
pnpm build
node dist/cli.js doctor
```

`doctor` prints a human summary (required vs optional, with fixes). Use `pnpm jsbench doctor --json` for scripts.

**How to invoke the CLI**

| Form | When |
|------|------|
| `pnpm jsbench <command>` | **Preferred** from a git clone |
| `node dist/cli.js <command>` | After `pnpm build` |
| bare `jsbench` | Only if you installed/linked the package globally |

Docs and replay hints use `pnpm jsbench …`.

---

## What It Measures

| Area | Examples |
|------|----------|
| Toolchains | Node.js, TypeScript |
| Package managers | npm, pnpm, Yarn |
| Frameworks | Next.js (App Router fixtures) |
| Environments | Native Linux, Docker (bind mounts, named volumes, limits) |
| Scales | Deterministic small → large synthetic projects |

This is **not** a web application, demo, or HTTP load tester. It is a CLI engineering tool that emits machine-readable and human-readable reports.

---

## Current capabilities

| Command | Status |
|---------|--------|
| `version` / `help` | Available |
| `doctor` | Available (human summary; `--json` optional) |
| `validate-profile <path\|id>` | Available |
| `list-profiles` (alias: `list`) | Available (table; `--json` optional) |
| `run --profile <path\|id> [--dry-run]` | Available (native + Docker) |
| `generate --template <id>` | Available (`fixture-lib`, `node-ts-lib`, `nextjs-app`, `nextjs-app-tailwind`, `pnpm-workspace`) |
| `report` / `report diff` | Available; optional `--fail-on-regression` (exit 7) |
| `replay` | Available; optional `--execute` |
| `leaderboard` | Local-first index (no upload) |

Also available as a library via package exports: config, profiles, metrics, native runner, reporting, `executeRun` / `runCli`.

### Official profile tiers

Built-in profiles are tagged **smoke** (fast), **benchmark** (standard), or **benchmark-slow** (optional lab). Full catalog: [profiles/README.md](profiles/README.md).

```bash
pnpm jsbench list-profiles
pnpm jsbench run --profile nextjs-app-smoke --dry-run
pnpm jsbench run --profile nextjs-app-benchmark          # local/lab; network + next build
pnpm jsbench run --profile pnpm-workspace-benchmark-slow # optional slow
```

Reports include `Profile` id/digest and `Profile tier` so citations stay unambiguous.

---

## M1 usage (native smoke)

```bash
pnpm jsbench doctor
pnpm jsbench validate-profile native-smoke
pnpm jsbench run --profile native-smoke
# Reports: ./reports/<run-id>/ (run.json + summary.md + index.html)
```

What `native-smoke` does:

1. Resolves `profiles/native-smoke.yaml`
2. Copies `fixtures/native-smoke/` into a run workspace under `generated/`
3. Runs `node index.js` via `raw.command` (no package-manager install)
4. Writes `reports/<run-id>/run.json`, `summary.md`, and `index.html`

Profile ids (e.g. `native-smoke`) and file paths both work for `--profile` / `validate-profile`.

---

## M2 usage (install/build matrix)

Requires **npm** and **pnpm** on `PATH` for the built-in matrix (Yarn supported via adapters when selected).

```bash
pnpm jsbench list-profiles
pnpm jsbench validate-profile install-build-matrix
pnpm jsbench run --profile install-build-matrix --dry-run

# Full run (network install + tsc build × npm/pnpm) — not in default CI
pnpm jsbench run --profile install-build-matrix
```

Optional slow tests (same path, gated):

```bash
JSBENCH_SLOW_TESTS=1 pnpm test:slow
```

```bash
# Generate a TypeScript library workspace
pnpm jsbench generate --template node-ts-lib --size tiny --seed 1

# Generate a Next.js App Router workspace (materialize only — no next build in default CI)
pnpm jsbench generate --template nextjs-app --size tiny --seed 1

# Next.js + Tailwind CSS v4 (PostCSS)
pnpm jsbench generate --template nextjs-app-tailwind --size tiny --seed 1

# pnpm multi-package workspace
pnpm jsbench generate --template pnpm-workspace --size tiny --seed 1
```

---

## M3 usage (Docker smoke)

Requires a running **Docker Engine** and `docker` on `PATH`.

```bash
pnpm jsbench doctor
pnpm jsbench validate-profile docker-smoke
pnpm jsbench run --profile docker-smoke --dry-run
pnpm jsbench run --profile docker-smoke
```

Compare with `native-smoke` (same fixture) using the checklist in [docs/06_DOCKER_BENCHMARK.md](docs/06_DOCKER_BENCHMARK.md) §14. Optional CI: workflow_dispatch with `docker_smoke: true`.

---

## M4 usage (reports)

```bash
# Re-render summary.md + index.html from an existing run (does not mutate run.json)
pnpm jsbench report ./reports/<run-id>

# Diff two runs
pnpm jsbench report diff ./reports/<runA> ./reports/<runB> --out ./diff-out

# CI regression gate (exit 7 on threshold breach)
pnpm jsbench report diff ./baseline ./reports/<run-id> \
  --metric durationMs \
  --fail-on-regression \
  --max-percent-increase 10 \
  --max-absolute-increase 50 \
  --require-same-profile-digest
```

### Replay a historical run

```bash
# Print toolchain exact: hints + suggested commands (stdout JSON)
pnpm jsbench replay ./reports/<run-id>
# or: pnpm jsbench replay --from ./reports/<run-id>/run.json

# Re-execute when the local profile digest still matches
pnpm jsbench replay ./reports/<run-id> --execute
```

### Local leaderboard index

```bash
# Index all run.json under ./reports into ./leaderboard (no upload)
pnpm jsbench leaderboard --from ./reports --out ./leaderboard
```

Enable optional collectors in a profile (`rusage`, `disk-usage`) and/or load plugins from config:

```yaml
# jsbench.config.yaml
plugins:
  - ./examples/plugins/sample-note-reporter.mjs
```

---

## Methodology (read before publishing results)

Honest comparisons require matching methodology. When citing or sharing results:

1. **Same profile digest** — record `profile.digest` from `run.json` (see `profiles/calibrated-digests.json` for built-ins).
2. **Cold vs warm** — stage `cache: cold|warm` and install reset policy must be stated.
3. **Network** — stages with `network: true` include registry time; do not mix with offline stages silently.
4. **Runner** — `native` vs `docker` (and Docker **mount** mode) are not interchangeable without disclosure.
5. **Pins** — fixture deps come from `templates/resolved-versions.json`; Docker images from `docker/resolved-images.json`.
6. **Attach `run.json`** — Markdown/HTML include a Citation section; prefer the immutable JSON as the source of truth.
7. **No winner banners** — the suite does not crown package managers or hardware.
8. **Outliers** — default aggregates use all measured samples; `metrics.outlierRule: iqr` is opt-in and always lists drops in `run.json`.

Schema compatibility draft: [docs/18_SCHEMA_COMPATIBILITY.md](docs/18_SCHEMA_COMPATIBILITY.md).

### Official built-in profiles

| Profile id | Purpose | Notes |
|------------|---------|--------|
| `native-smoke` | Fast native path | No registry; default CI |
| `install-build-matrix` | npm + pnpm install/build | Network; optional slow CI |
| `docker-smoke` | Docker bind-mount smoke | Needs daemon; optional CI |
| `foundation-sample` | Loader / dry-run sample | Not a publishable smoke |

Dry-run any profile without executing stages:

```bash
pnpm jsbench run --profile native-smoke --dry-run
pnpm jsbench run --profile install-build-matrix --dry-run
pnpm jsbench run --profile docker-smoke --dry-run
```

---

## Quickstart (dev checks)

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build

pnpm jsbench doctor
pnpm jsbench run --profile native-smoke --dry-run
```

Lint/format uses **Biome**. Optional config: copy `jsbench.config.example.yaml` → `jsbench.config.yaml`.

---

## Design at a Glance

```mermaid
flowchart LR
  Profiles --> Engine
  Engine --> Generator
  Engine --> Native[Native_Runner]
  Engine --> Docker[Docker_Runner]
  Native --> Metrics
  Docker --> Metrics
  Metrics --> Reports
```

- **Profiles** declare matrices and stages  
- **Generator** builds deterministic fixture apps (M2)  
- **Runners** execute on host or in containers  
- **Metrics / reporting** produce JSON, Markdown, and HTML artifacts  

Full architecture: [docs/03_ARCHITECTURE.md](docs/03_ARCHITECTURE.md)

---

## Documentation (source of truth)

| Doc | Topic |
|-----|-------|
| [AGENTS.md](AGENTS.md) | Operating manual for AI agents (workflow, DoD, stop rules) |
| [00 Overview](docs/00_PROJECT_OVERVIEW.md) | Vision and scope |
| [01 Goals](docs/01_PROJECT_GOALS.md) | Goals and success criteria |
| [02 Requirements](docs/02_REQUIREMENTS.md) | Functional / non-functional requirements |
| [03 Architecture](docs/03_ARCHITECTURE.md) | Modules, CLI, config, layout |
| [04 Generator](docs/04_GENERATOR_ENGINE.md) | Workload generation |
| [05 Native](docs/05_NATIVE_BENCHMARK.md) | Native Linux runner |
| [06 Docker](docs/06_DOCKER_BENCHMARK.md) | Docker runner |
| [07 Metrics](docs/07_METRICS_ENGINE.md) | Collectors and aggregates |
| [08 Reporting](docs/08_REPORTING.md) | Artifacts and diffs |
| [09 Version policy](docs/09_VERSION_POLICY.md) | How tool versions are selected |
| [10 Coding standard](docs/10_CODING_STANDARD.md) | Code and docs standards |
| [11 Dependency policy](docs/11_DEPENDENCY_POLICY.md) | Dependency governance |
| [12 Roadmap](docs/12_ROADMAP.md) | Milestones M0–M6 |
| [13 Tasks](docs/13_TASKS.md) | Implementation task tracker |
| [14 Changelog](docs/14_CHANGELOG.md) | Release history |
| [15 FAQ](docs/15_FAQ.md) | Common questions |
| [16 Contributing](docs/16_CONTRIBUTING.md) | How to contribute |
| [17 Implementation plan](docs/17_IMPLEMENTATION_PLAN.md) | Commit-sized slices S0–S18 |
| [18 Schema compatibility](docs/18_SCHEMA_COMPATIBILITY.md) | v1 contract (1.x window) |
| [19 RC checklist](docs/19_RELEASE_CANDIDATE_CHECKLIST.md) | `1.1.0-rc.1` release checklist |
| [20 Hardware validation](docs/20_HARDWARE_VALIDATION_PLAN.md) | Pre-final hardware test plan |
| [Release notes 1.1.0-rc.1](docs/RELEASE_NOTES_1.1.0-rc.1.md) | Short RC announcement |

---

## Repository Layout

```
nodejs-benchmark-suite/
├── docs/           # Specifications (authoritative)
├── src/            # TypeScript suite (single package)
├── schemas/        # JSON Schema for config + profiles
├── profiles/       # Built-in profiles (incl. native-smoke)
├── fixtures/       # Static workloads (pre-generator)
├── docker/         # Image policy pins (+ future Dockerfiles)
├── templates/      # Workload templates (fixture-lib, node-ts-lib, nextjs-app, nextjs-app-tailwind, pnpm-workspace)
├── packages/       # Deferred monorepo split (see packages/README.md)
├── docker/         # Runner images / compose (future)
├── scripts/        # Maintainer scripts (future)
├── tests/          # Integration tests (future)
├── generated/      # Gitignored workspaces
└── reports/        # Gitignored run outputs
```

---

## Roadmap (summary)

| Milestone | Focus |
|-----------|--------|
| **M0** | Planning & specs — done |
| **Foundation (S1–S3)** | Tooling, config, profile validation — done |
| **M1 (S4–S9)** | Native MVP (`doctor`, `run`, `native-smoke`) — **done** |
| **M2 (S10–S12)** | Generator + package-manager matrices — **done** |
| **M3 (S13)** | Docker runner + mount modes — **done** |
| **M4 (S14)** | HTML reports + run diffs — **done** |
| **M5 (S15–S16)** | Plugins + collectors + hardening — **done** |
| **M6 (S17–S18)** | Calibration + release `1.0.0` — **done** |
| **Post-1.0 (S19–S26)** | Gates, replay, IQR, leaderboard, templates, docker-stats, official template profiles — **done** |

Details: [docs/12_ROADMAP.md](docs/12_ROADMAP.md) · Tasks: [docs/13_TASKS.md](docs/13_TASKS.md) · Slices: [docs/17_IMPLEMENTATION_PLAN.md](docs/17_IMPLEMENTATION_PLAN.md)

---

## License

[MIT](LICENSE)
