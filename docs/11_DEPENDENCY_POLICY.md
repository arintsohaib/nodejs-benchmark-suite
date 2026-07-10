# Dependency Policy

**Status:** Planning  
**Last updated:** July 2026

---

## 1. Goals

- Keep the suite **lean**, **auditable**, and **maintainable**
- Prefer standard library and small focused libraries over frameworks
- Separate **suite dependencies** from **fixture/workload dependencies**

---

## 2. Two Dependency Worlds

| World | Where | Policy |
|-------|-------|--------|
| **Suite** | Root / `packages/*` manifests | Strict review, pinned via lockfile |
| **Fixtures** | Generated workspaces / templates | Governed by version policy; not installed into the suite |

Fixture dependencies must never be hoisted into the suite’s runtime package graph.

---

## 3. Allowed Suite Dependency Categories

| Category | Examples of purpose | Guidance |
|----------|---------------------|----------|
| CLI parsing | Command routing, help | One library |
| YAML/JSON | Profile load/validate | Prefer well-maintained parsers |
| Schema validation | Ajv or equivalent for JSON Schema | One validator stack |
| Testing | Test runner + assertions | One primary runner |
| Lint/format | Dev-only | One toolchain |
| Docker (optional) | If not shelling to CLI only | Optional peer/extra |
| Logging | Structured logs | Minimal facade |

Avoid:

- Full UI frameworks
- Heavy agent/orchestration frameworks
- Multiple overlapping HTTP clients
- Unnecessary babel/webpack chains for the CLI (use Node’s native TS loader strategy or ship compiled `dist/`)

---

## 4. Adding a Suite Dependency

Checklist for every new runtime dependency:

1. What problem does it solve that stdlib/`*` existing deps cannot?
2. License compatible with MIT distribution?
3. Maintenance health (releases, issues, bus factor)?
4. Install size / transitive risk acceptable?
5. Can it be a **devDependency** instead?
6. Document the decision in the PR description.

New dependencies require approval in code review (any maintainer). Wide transitive trees need explicit justification.

---

## 5. Lockfiles & Install

- Commit a lockfile for the suite (`pnpm-lock.yaml` or `package-lock.json`—choose one package manager for *developing the suite* at kickoff and stick to it).
- CI installs with frozen lockfile.
- Renovate/Dependabot optional; security updates prioritized.

**Note:** The suite’s own package manager choice is independent of the package managers *under test*.

---

## 6. Version Ranges (Suite)

- Runtime deps: prefer caret ranges on minor-safe packages, exact pins for high-risk ones.
- Follow [09_VERSION_POLICY.md](09_VERSION_POLICY.md) for Node engine field: declare `engines.node` with a policy-derived minimum Active LTS at kickoff, updated as LTS moves.

---

## 7. Fixture Dependency Rules

- Templates declare dependencies via policy aliases or pins.
- Do not vendor large `node_modules` trees in git.
- Prefer fewer direct fixture deps that still exercise realistic install/build cost.
- Next.js fixtures should use the official dependency set required by that Next release.

---

## 8. Native System Dependencies

Documented in README/`doctor`:

- Docker Engine (for Docker profiles)
- Optional OS packages for advanced collectors

System packages are not npm dependencies; install guidance belongs in docs.

---

## 9. Licensing

- Suite: MIT (see `LICENSE`)
- Do not add GPL/AGPL dependencies to the suite runtime without an explicit governance decision (default: **reject** for runtime).
- Dev-only GPL tools discouraged; prefer permissive licenses throughout.

---

## 10. Security

- No postinstall scripts from obscure packages without review
- Avoid downloading binaries outside package manager / Docker flows
- Pin GitHub Actions by SHA when workflows are added
- Run `npm audit` / equivalent in CI as non-blocking initially, blocking for critical after M1

---

## 11. Related Documents

- Version policy: [09_VERSION_POLICY.md](09_VERSION_POLICY.md)
- Coding standard: [10_CODING_STANDARD.md](10_CODING_STANDARD.md)
- Contributing: [16_CONTRIBUTING.md](16_CONTRIBUTING.md)
