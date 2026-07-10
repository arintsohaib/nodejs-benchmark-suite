# FAQ

**Last updated:** July 2026

---

## General

### What is this project?

An open-source **benchmark platform** for measuring JavaScript *development* performance (install, typecheck, build, and related workflows) on native Linux and in Docker—across package managers, project sizes, and hardware.

### Is this a web app?

No. It is a CLI engineering tool that emits reports. There is no product UI in scope for v1.

### How is this different from runtime benchmarks?

Runtime tools measure servers or browser apps under load. This suite measures **developer-loop** costs: dependency installation, TypeScript, Next.js builds, and similar waits.

### Why not just use a shell script?

Ad-hoc scripts rarely share schemas, environment fingerprints, cold/warm discipline, matrix expansion, or comparable report formats. This project standardizes methodology.

---

## Methodology

### Will results be identical on two machines?

No. Absolute times vary with CPU, disk, background load, and thermal state. The suite records fingerprints and statistics so comparisons are *interpretable*, not magical.

### Do install benchmarks include network time?

If the stage hits a registry, yes—and the stage is labeled as network-using. Profiles can use run-scoped caches and offline modes to reduce or eliminate network variance.

### Which package manager is “fastest”?

The suite does not crown winners. It reports numbers for **your** environment. Rankings change with disk, OS, and project shape.

### Why Docker at all?

Many teams develop or CI inside containers. Mount strategy and resource limits often dominate perceived “Node is slow” complaints. Docker modes make that measurable.

### Native vs Docker—what should I trust?

Trust both in context. Use native for host capability; use Docker for containerized workflow realism. Compare only with matching profile digests and documented mount modes.

---

## Versions & Tooling

### Which Node.js version do you require?

**Node.js ≥ 20** (Active LTS recommended). `pnpm jsbench doctor` fails if the running Node major is below 20. See also [09_VERSION_POLICY.md](09_VERSION_POLICY.md).

### How do I install pnpm on Linux without root?

```bash
mkdir -p "$HOME/.local/bin"
corepack enable --install-directory "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
corepack prepare pnpm@10.12.4 --activate
```

Persist the `PATH` export in your shell profile. Full walkthrough: README “First-time setup (Linux)”.

### How should I invoke the CLI?

From a clone: **`pnpm jsbench <command>`**. After `pnpm build`: `node dist/cli.js <command>` is equivalent. A bare `jsbench` command only works if you linked/installed the package globally.

### Will you support Windows and macOS?

Linux is primary for v1. Other OS support is post-1.0 roadmap material because filesystem semantics (especially Docker bind mounts) differ.

### Do I need every package manager installed?

Only those selected by the profile matrix. `pnpm jsbench doctor` lists **required** vs **optional** tools and prints actionable fixes for anything missing.

---

## Contributing & Process

### Can I add a profile without writing TypeScript?

Yes—profiles and templates are data. Follow [16_CONTRIBUTING.md](16_CONTRIBUTING.md) and the profile schema (published at M1).

### Where is the code?

Foundation lives under `src/`. Benchmark execution begins at slice **S4+** / remaining M1 tasks ([12_ROADMAP.md](12_ROADMAP.md), [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md)).

### How should AI agents work in this repo?

Follow [../AGENTS.md](../AGENTS.md): required reading order, one milestone/slice per turn, validation gates, and stop-for-review rules.

### How do I report a methodology bug?

Open an issue describing profile id/digest, environment fingerprint, and why the measurement is misleading. Methodology bugs are treated as P0/P1.

---

## Legal

### What license?

MIT — see `LICENSE`.

### Can I publish results?

Yes. Cite suite version, commit, profile digest, and include environment summary. See reporting guidelines in [08_REPORTING.md](08_REPORTING.md).
