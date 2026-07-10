# AGENTS.md — Operating Manual for AI Agents

This file is the **permanent operating manual** for any AI agent working in this repository.

It does **not** replace the technical specifications under `docs/`. It tells agents *how to work* here: what to read, in what order, how to ship one milestone at a time, and when to stop.

If this file conflicts with `docs/`, treat **`docs/` as the product source of truth** for architecture and behavior, then update this file so the workflow stays aligned.

---

## 1. Project mission and goals

**Mission:** Build an open-source **engineering benchmark platform** for modern JavaScript *development* performance (install, typecheck, build, and related developer-loop costs)—on native Linux and in Docker—across package managers, project sizes, hardware, and storage.

**Not in scope:** Web apps, demos, HTTP load tests, Lighthouse/CWV suites, or crowning universal “winners” in output copy.

**Goals (summary):** reproducible measurements, fair environment comparison, trustworthy JSON/Markdown/HTML artifacts, extensibility, Linux-first engineering quality.

Full goals and non-goals: [docs/01_PROJECT_GOALS.md](docs/01_PROJECT_GOALS.md)  
Overview and scope: [docs/00_PROJECT_OVERVIEW.md](docs/00_PROJECT_OVERVIEW.md)  
Human entry point: [README.md](README.md)

---

## 2. Required reading order

Before making changes, read in this order:

| Order | Document | Why |
|------:|----------|-----|
| 1 | [AGENTS.md](AGENTS.md) (this file) | Workflow constraints |
| 2 | [README.md](README.md) | Current status and how to run checks |
| 3 | [docs/13_TASKS.md](docs/13_TASKS.md) | What is done vs next |
| 4 | [docs/17_IMPLEMENTATION_PLAN.md](docs/17_IMPLEMENTATION_PLAN.md) | Slice scope (S*), test gates, locked decisions |
| 5 | [docs/12_ROADMAP.md](docs/12_ROADMAP.md) | Product milestones (M*) |
| 6 | [docs/03_ARCHITECTURE.md](docs/03_ARCHITECTURE.md) | Module boundaries |
| 7 | Subsystem docs as needed | Generator, native, Docker, metrics, reporting |
| 8 | [docs/02_REQUIREMENTS.md](docs/02_REQUIREMENTS.md) | FR/NFR acceptance for the slice |
| 9 | [docs/10_CODING_STANDARD.md](docs/10_CODING_STANDARD.md) | Code/doc style |
| 10 | [docs/09_VERSION_POLICY.md](docs/09_VERSION_POLICY.md) | Version selection rules |
| 11 | [docs/11_DEPENDENCY_POLICY.md](docs/11_DEPENDENCY_POLICY.md) | Dependency governance |
| 12 | [docs/14_CHANGELOG.md](docs/14_CHANGELOG.md) | What to record |

Also skim [docs/15_FAQ.md](docs/15_FAQ.md) and [docs/16_CONTRIBUTING.md](docs/16_CONTRIBUTING.md) when touching contributor-facing behavior.

**Do not** implement from memory of a prior chat. Re-check `TASKS` + the relevant slice in the implementation plan every session.

---

## 3. Development workflow (documentation first)

1. **Identify** the next incomplete slice (`S*`) from [docs/17_IMPLEMENTATION_PLAN.md](docs/17_IMPLEMENTATION_PLAN.md) and matching tasks in [docs/13_TASKS.md](docs/13_TASKS.md).
2. **Verify** current code matches documented architecture for that area. If docs and code diverge, **fix the inconsistency first** (prefer updating code to match docs unless docs are wrong—then fix docs in the same change set).
3. **Implement only that slice/milestone**—no speculative work on later slices.
4. **Validate** (see §8).
5. **Update documentation** affected by the change (see §9).
6. **Stop** and wait for human review (see §12). Do not start the next milestone until approved.

Specs under `docs/` are authoritative for product behavior. Implementation must follow them.

---

## 4. Milestone-based development process

- **Roadmap milestones (`M*`)** describe product outcomes ([docs/12_ROADMAP.md](docs/12_ROADMAP.md)).
- **Implementation slices (`S*`)** are the engineering units of work ([docs/17_IMPLEMENTATION_PLAN.md](docs/17_IMPLEMENTATION_PLAN.md)).
- Prefer **one slice per agent turn / PR**. A roadmap milestone may span multiple slices (e.g. M1 = S4–S9 after foundation).
- Each slice must leave the repo **buildable and green**.
- Do not register CLI commands that crash because their stack is unfinished—omit them or return a clear not-implemented error (see implementation plan standing rules).
- Track status in [docs/13_TASKS.md](docs/13_TASKS.md); record decisions in that file’s Decisions Log.

**Current position (check TASKS/README if stale):** **S18** complete — M6 exit; suite **`1.0.0`**. Further work follows the post-1.0 backlog / parking lot (new slices as approved).

---

## 5. Engineering principles

Follow the design pillars in [docs/00_PROJECT_OVERVIEW.md](docs/00_PROJECT_OVERVIEW.md):

1. **Reproducibility** — profiles + fingerprints make runs comparable.
2. **Isolation** — workloads do not contaminate suite state or operator caches by default.
3. **Comparability** — shared schemas for metrics, environments, reports.
4. **Honesty** — label network stages; make cold/warm explicit; no silent outlier dropping.
5. **Extensibility** — runners/collectors/profiles without core rewrites.
6. **Operator clarity** — CLI-first; fail loud on invalid config/tools.

Additional rules:

- Respect **module boundaries** in [docs/03_ARCHITECTURE.md](docs/03_ARCHITECTURE.md).
- Prefer **argv arrays**; no `shell: true` on default paths.
- **Methodology bugs** (misleading timings) are P0/P1—treat seriously.
- Do not claim package-manager or hardware “winners” in suite output copy.
- Keep the suite lean per [docs/11_DEPENDENCY_POLICY.md](docs/11_DEPENDENCY_POLICY.md).

---

## 6. Coding standards reference

Authoritative detail: [docs/10_CODING_STANDARD.md](docs/10_CODING_STANDARD.md).

Locked kickoff choices ([docs/17_IMPLEMENTATION_PLAN.md](docs/17_IMPLEMENTATION_PLAN.md)):

| Topic | Choice |
|-------|--------|
| Language | TypeScript, `strict` |
| Package manager (suite) | pnpm |
| Layout | Single package under `src/` (monorepo deferred) |
| CLI name | `jsbench` |
| Lint/format | Biome (not ESLint+Prettier unless decision log changes) |
| Tests | `node:test` + `tsx`; colocated `src/**/*.test.ts` |
| Files | `kebab-case.ts` |
| `any` | Forbidden |

---

## 7. Version policy reference

Authoritative detail: [docs/09_VERSION_POLICY.md](docs/09_VERSION_POLICY.md).

- Do **not** hardcode eternal Node/Next/pnpm version numbers into docs as permanent requirements.
- Prefer **policy aliases** (`lts-active`, `latest-stable`, `exact:…`) and resolve at kickoff/release/run as documented.
- Prefer **Active LTS** for suite runtime and default Docker images.
- Suite semver is independent of fixture toolchain versions.

---

## 8. Validation requirements

Before declaring a milestone done, run from the repo root (see [README.md](README.md)):

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also exercise any new or changed CLI paths (e.g. `node dist/cli.js …`).

Requirements:

- No TypeScript errors
- Lint and formatting clean (`pnpm lint` / Biome)
- Tests pass; add tests for new behavior
- No unused dead code introduced for “maybe later”
- No `TODO` placeholders in shipped code unless explicitly tracked in [docs/13_TASKS.md](docs/13_TASKS.md) or the implementation plan
- Unimplemented commands must not stack-trace

CI expectations: [.github/workflows/ci.yml](.github/workflows/ci.yml)

---

## 9. Documentation update requirements

Update in the **same change set** when behavior or public contracts change:

| Change type | Update |
|-------------|--------|
| User-visible feature/fix | [docs/14_CHANGELOG.md](docs/14_CHANGELOG.md) `[Unreleased]` |
| Task completion / decisions | [docs/13_TASKS.md](docs/13_TASKS.md) |
| Milestone status | [docs/12_ROADMAP.md](docs/12_ROADMAP.md), [README.md](README.md) |
| Schema / CLI / architecture | Matching `docs/0*.md` + [docs/03_ARCHITECTURE.md](docs/03_ARCHITECTURE.md) as needed |
| Contributor workflow | [docs/16_CONTRIBUTING.md](docs/16_CONTRIBUTING.md), this file if process changes |

Do not leave README status claiming “planning only” when code has moved on.

---

## 10. Git workflow expectations

- Prefer **one slice → one commit** (or a short stack that each keeps `main` green).
- Imperative commit subjects (e.g. `Add single-cell RunPlan planner`).
- Reference task ids when useful (`T-M1-05`, `S4`).
- Do **not** commit secrets, `generated/`, `reports/`, or `node_modules/`.
- Do **not** commit unless the human asks—or the session explicitly authorizes a commit after validation.
- Do not use destructive git commands unless explicitly requested.
- Do not skip hooks unless explicitly requested.

Human contributor norms: [docs/16_CONTRIBUTING.md](docs/16_CONTRIBUTING.md)

---

## 11. Definition of Done (every milestone / slice)

A slice is done only when **all** of the following hold:

- [ ] Scope matches the slice in [docs/17_IMPLEMENTATION_PLAN.md](docs/17_IMPLEMENTATION_PLAN.md)—no silent scope creep into later slices
- [ ] Architecture boundaries respected
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` succeed
- [ ] New/changed behavior covered by tests appropriate to the slice
- [ ] Docs/changelog/tasks updated as required in §9
- [ ] CLI surface remains safe (no half-wired crashing commands)
- [ ] No methodology regressions introduced knowingly
- [ ] Ready for a clean commit, with a short summary for the human reviewer

---

## 12. Stop after one milestone — wait for review

**Hard rule:** After completing a single milestone/slice (including validation and doc updates):

1. Summarize what changed, why, key files, risks, and the recommended next slice.
2. **Stop.** Do not start the next milestone.
3. Wait for explicit human approval before continuing.

This keeps reviewable diffs and prevents runaway multi-milestone edits.

---

## Quick reference — key paths

| Path | Role |
|------|------|
| `src/` | Suite implementation (single package) |
| `schemas/` | JSON Schema for config and profiles |
| `profiles/` | Built-in / sample profiles |
| `docs/` | Authoritative specifications |
| `generated/`, `reports/` | Runtime outputs (gitignored) |

---

## Related documents

- [README.md](README.md)
- [docs/00_PROJECT_OVERVIEW.md](docs/00_PROJECT_OVERVIEW.md) through [docs/18_SCHEMA_COMPATIBILITY.md](docs/18_SCHEMA_COMPATIBILITY.md)
- [docs/16_CONTRIBUTING.md](docs/16_CONTRIBUTING.md) — human contributors; this file — AI agents (overlapping norms, different emphasis)
