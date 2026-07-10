# Project Goals

**Status:** Planning  
**Last updated:** July 2026

---

## Vision

Become the default open-source way to answer:

> “How fast is *this* machine / disk / OS / Docker setup for day-to-day Node.js, TypeScript, and Next.js development?”

Results must be explainable, comparable, and honest about what was measured.

---

## Primary Goals

### G1 — Measure the developer loop

Capture wall-clock and resource cost of workflows developers actually wait on:

- Dependency install / resolution / linking
- TypeScript typecheck
- Production and development builds
- Test runner cold start (optional profile stages)
- Cache-sensitive repeats (cold vs warm)

### G2 — Compare environments fairly

Support matrices across:

| Dimension | Examples |
|-----------|----------|
| Execution mode | Native Linux, Docker |
| Package manager | npm, pnpm, Yarn |
| Project scale | Fixture sizes `tiny` / `small` / `medium` / `large` (see generator presets) |
| Storage | Local SSD/NVMe, network mounts (when declared) |
| Docker I/O | Bind mount, named volume, tmpfs (where supported) |
| Hardware | CPU, RAM, architecture recorded in fingerprints |

### G3 — Produce trustworthy artifacts

Every run emits:

- Environment fingerprint
- Profile identity and digest
- Per-stage timings and selected resource metrics
- Machine-readable JSON plus human Markdown/HTML summaries

### G4 — Stay engineering-grade

Prefer correctness of methodology over flashy UX. Fail loudly on invalid profiles, missing tools, or contaminated workspaces.

### G5 — Enable community extension

Third parties can add:

- Profiles
- Workload templates
- Metric collectors
- Report formatters
- Runners (future: remote CI agents)

without modifying the core orchestration contract.

---

## Secondary Goals

- Document methodology so published blog/hardware reviews can cite the suite version and profile digests.
- Keep the suite itself lightweight: TypeScript CLI, minimal runtime dependencies.
- Support offline or network-restricted modes for install stages that use pre-seeded caches or vendored tarballs (explicit profile flags).
- Provide statistical discipline: configurable iterations, warmup discard, summary statistics (mean, median, p95, stdev).

---

## Non-Goals

| Non-goal | Rationale |
|----------|-----------|
| Ranking “best” package manager universally | Results are environment-specific; suite reports data, not marketing winners |
| Replacing CI product benchmarks | Focus is local/dev and controlled Docker, not vendor CI marketing |
| Full-stack app correctness testing | Generated apps are fixtures, not product under test |
| GPU / ML training benchmarks | Out of domain |
| Windows/macOS as v1 primary targets | Design for Linux first; other OS support is later roadmap |
| Guaranteeing bit-identical timings | Hardware noise is real; we quantify variance instead |

---

## Success Criteria

The planning phase succeeds when:

1. All `docs/*` documents are complete and internally consistent.
2. Repository layout, module boundaries, and schemas are specified.
3. Roadmap and task list are actionable for implementation.

Implementation success is **phased** (see [12_ROADMAP.md](12_ROADMAP.md) and [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md)):

| Gate | Succeeds when |
|------|----------------|
| **M1 Native MVP** | A developer runs a documented profile on native Linux and gets JSON + Markdown reports; CI runs unit/contract tests (no Docker, no multi-pm matrix required). |
| **M2 Generator & matrices** | ≥2 package managers and ≥2 project sizes are comparable in one matrix report; generator digests are tested in CI. |
| **M3 Docker** | The same profile digest can run under Docker with a declared mount strategy; native↔Docker comparison is possible. |
| **M4+** | Plugins, hardening, and 1.0 calibration per roadmap. |

Environment fingerprints are required from M1 onward so early results remain interpretable.

---

## Quality Bar for Published Results

A result is considered **publishable** only if the report includes:

- Suite version (semver) and git commit when available
- Profile id + content digest
- Node.js and package-manager versions actually used
- OS, CPU model, core count, memory, architecture
- Storage path class if known (e.g. local vs bind-mounted)
- Iteration count and summary statistics
- Explicit cold/warm and network policy flags

---

## Ethical / Scientific Stance

- Do not silently drop outliers without documenting the rule.
- Do not claim “X is faster than Y” in suite output copy; present numbers and confidence context.
- Label stages that hit the network.
- Prefer open formats (JSON, Markdown) over proprietary blobs.
