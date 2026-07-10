# Requirements

**Status:** Planning  
**Last updated:** July 2026

---

## 1. Functional Requirements

### 1.1 CLI

| ID | Requirement |
|----|-------------|
| FR-CLI-01 | Provide a single entrypoint CLI (name TBD at implementation; docs use `jsbench` as the working command). |
| FR-CLI-02 | Support commands: `run`, `list-profiles`, `validate-profile`, `generate`, `report`, `replay`, `leaderboard`, `doctor`, `version`. |
| FR-CLI-03 | Accept profile path or profile id; allow overrides for iterations, runners, package managers, and output directory. |
| FR-CLI-04 | Exit non-zero on failed stages, invalid config, or missing prerequisites unless `--continue-on-error` is set. |
| FR-CLI-05 | Support `--dry-run` that resolves the plan without executing timed stages. |
| FR-CLI-06 | Emit progress on stderr; keep stdout free for optional JSON piping where documented. |

### 1.2 Profiles

| ID | Requirement |
|----|-------------|
| FR-PROF-01 | Profiles are declarative YAML (preferred) or JSON documents with a versioned schema. |
| FR-PROF-02 | A profile defines: metadata, workload, matrix axes, stages, runner settings, metrics, and reporting options. |
| FR-PROF-03 | Built-in profiles ship under `profiles/`; user profiles may live anywhere on disk. |
| FR-PROF-04 | Profile validation rejects unknown required fields and unsupported combinations before execution. |
| FR-PROF-05 | Each executed profile records a canonical content digest in the run artifact. |

### 1.3 Workload Generator

| ID | Requirement |
|----|-------------|
| FR-GEN-01 | Generate deterministic fixture projects from templates and size parameters. |
| FR-GEN-02 | Support at least: plain Node/TS library, Next.js App Router app, multi-package workspace (phase-gated). |
| FR-GEN-03 | Size presets control file count, dependency count, and TS complexity—not random noise. |
| FR-GEN-04 | Generation is idempotent for the same seed and parameters (same tree digest). |
| FR-GEN-05 | Generated trees land under a configurable workspace root (default: `generated/`, gitignored). |

### 1.4 Benchmark Engine

| ID | Requirement |
|----|-------------|
| FR-ENG-01 | Expand a profile into a concrete run plan (cartesian product of matrix axes × stages × iterations). |
| FR-ENG-02 | Execute stages in declared order with explicit cleanup and isolation rules. |
| FR-ENG-03 | Support warmup iterations that are recorded but excluded from primary summary stats when configured. |
| FR-ENG-04 | Enforce workspace reset policies: `clean-install`, `keep-node-modules`, `purge-all` as stage options. |
| FR-ENG-05 | Persist a run manifest before stages begin and finalize it after completion or abort. |

### 1.5 Native Runner

| ID | Requirement |
|----|-------------|
| FR-NAT-01 | Execute stages on the host using discovered or pinned toolchains. |
| FR-NAT-02 | Isolate each matrix cell in its own workspace directory. |
| FR-NAT-03 | Capture command exit codes, stdout/stderr paths, and wall time. |
| FR-NAT-04 | Refuse to run if `doctor` checks fail for required tools (configurable strictness). |

### 1.6 Docker Runner

| ID | Requirement |
|----|-------------|
| FR-DOC-01 | Execute stages inside containers using declared images and mount modes. |
| FR-DOC-02 | Support bind mounts and named volumes; document performance implications. |
| FR-DOC-03 | Allow CPU/memory limits via Docker (or Compose) resource flags. |
| FR-DOC-04 | Record image digests / tags resolved at run time in the fingerprint. |
| FR-DOC-05 | Clean up containers and optional volumes according to profile retention policy. |

### 1.7 Metrics

| ID | Requirement |
|----|-------------|
| FR-MET-01 | Always record wall-clock duration per stage iteration. |
| FR-MET-02 | Optionally record peak RSS, CPU time, and disk write/read bytes when collectors are enabled. |
| FR-MET-03 | Metrics conform to a versioned JSON schema. |
| FR-MET-04 | Support aggregation: count, min, max, mean, median, p95, stdev. |

### 1.8 Reporting

| ID | Requirement |
|----|-------------|
| FR-REP-01 | Write raw run JSON under `reports/<run-id>/`. |
| FR-REP-02 | Generate Markdown summary suitable for PR comments or README snippets. |
| FR-REP-03 | Generate a simple static HTML report for local viewing. |
| FR-REP-04 | Support comparing two run artifacts (`report diff`). |
| FR-REP-05 | Never mutate prior run directories; new runs get new ids. |

### 1.9 Extensibility

| ID | Requirement |
|----|-------------|
| FR-EXT-01 | Stages invoke commands through a runner interface, not hard-coded package-manager switches in the engine core. |
| FR-EXT-02 | Collectors and reporters register via a stable plugin interface (in-process for v1). |
| FR-EXT-03 | Templates are data files; adding a template does not require engine changes if it matches the template contract. |

---

## 2. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | **Linux-first:** Primary support is modern Linux distributions; CI reference is Debian/Ubuntu-class. |
| NFR-02 | **Determinism:** Given fixed seeds, templates, and offline caches, workspace digests match. |
| NFR-03 | **Performance overhead:** Orchestration overhead should be negligible vs stage times (target &lt; 1% for stages ≥ 5s). |
| NFR-04 | **Security:** Do not execute untrusted profile shell without explicit opt-in; prefer argv arrays. |
| NFR-05 | **Privacy:** Fingerprints must not include secrets; redact env vars matching deny lists. |
| NFR-06 | **Accessibility of docs:** Specs in Markdown; diagrams in Mermaid. |
| NFR-07 | **Testability:** Schemas, planners, and generators are unit-testable without Docker. |
| NFR-08 | **License:** OSI-approved license (MIT) for broad adoption. |

---

## 3. Environment & Tooling Requirements (Host)

### Required for native runs

- Linux host
- Node.js per [09_VERSION_POLICY.md](09_VERSION_POLICY.md)
- At least one supported package manager
- Sufficient disk for generated workspaces and `node_modules`

### Required for Docker runs

- Docker Engine with permission to run containers
- Ability to pull or load declared images (or offline image availability)

### Optional

- `pnpm`, Yarn Berry (Yarn Classic only via explicit regression profiles)
- `perf`, `pidstat`, or cgroup access for advanced collectors
- Compose v2 for multi-service profiles (later milestone)

---

## 4. Configuration Requirements

| ID | Requirement |
|----|-------------|
| FR-CFG-01 | Global defaults via `jsbench.config.yaml` at repo root or XDG config path. |
| FR-CFG-02 | Precedence: CLI flags &gt; env vars &gt; project config &gt; profile &gt; built-in defaults. |
| FR-CFG-03 | Env vars use a common prefix (e.g. `JSBENCH_`). |
| FR-CFG-04 | Paths in config expand `~` and support relative paths from config file location. |

---

## 5. Testing Requirements

| ID | Requirement |
|----|-------------|
| FR-TEST-01 | Unit tests for planner, schema validation, aggregations, path isolation. |
| FR-TEST-02 | Contract tests for profile and report JSON schemas. |
| FR-TEST-03 | Integration tests for generator output digests. |
| FR-TEST-04 | Optional marked “slow” / “docker” tests not run in default CI. |
| FR-TEST-05 | Golden Markdown fixtures for report rendering. |

---

## 6. Documentation Requirements

| ID | Requirement |
|----|-------------|
| FR-DOC-01 | Every public CLI command documented in README and CONTRIBUTING. |
| FR-DOC-02 | Methodology section explains cold/warm, network, and Docker mount caveats. |
| FR-DOC-03 | Changelog follows Keep a Changelog principles ([14_CHANGELOG.md](14_CHANGELOG.md)). |
| FR-DOC-04 | Version policy never embeds stale “current version” numbers as requirements; it defines selection rules. |

---

## 7. Acceptance Mapping

Requirements are delivered incrementally. A milestone must not claim an `FR-*` until that slice is implemented and tested.

| Milestone | Must satisfy (subset) |
|-----------|------------------------|
| M0 Planning | This requirements doc complete and reviewed |
| M1 Core CLI + native smoke | FR-CLI-01; FR-CLI-02 for `doctor` / `validate-profile` / `run` / `version` only; FR-CLI-03..06 as applicable to those commands; FR-PROF-01..05 (single-cell profiles OK); FR-ENG-02..05; FR-ENG-01 limited to trivial/single-cell plans; FR-NAT-*; FR-MET-01 + FR-MET-04 for `durationMs`; FR-REP-01..02; FR-CFG-*; FR-TEST-01..02 |
| M2 Generator + matrices | FR-GEN-01..05 except multi-package workspace; FR-ENG-01 full matrix; package-manager adapters; FR-TEST-03; remaining FR-CLI-02 commands `list-profiles` / `generate` |
| M3 Docker runner | FR-DOC-* |
| M4 Reporting polish | FR-REP-03..05; FR-CLI-02 `report` / `report diff`; FR-TEST-05 |
| M5 Extensibility | FR-EXT-*; optional FR-GEN-02 workspace template; optional FR-MET-02 collectors |

See [12_ROADMAP.md](12_ROADMAP.md), [13_TASKS.md](13_TASKS.md), and [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md).
