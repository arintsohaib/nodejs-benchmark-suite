# Version Policy

**Status:** Active — pins calibrated for suite `1.0.0`  
**Last updated:** July 2026

---

## 1. Intent

This project **does not hardcode toolchain version numbers** into architecture docs or profiles as permanent requirements. Instead, it defines **resolution policies** so that when implementation and calibration begin, the suite selects the **latest appropriate stable releases available at that time**.

Today’s calendar context for planning: **July 2026**. Implementers must re-resolve versions at development kickoff and at each release—not copy guessed numbers from memory.

---

## 2. Definitions

| Term | Meaning |
|------|---------|
| **Policy alias** | A symbolic version request such as `lts-active` or `latest-stable` |
| **Resolved version** | The concrete version chosen when a run or generation occurs |
| **Pin** | Writing the resolved version into a workspace or lockfile for reproducibility |
| **Suite version** | Semver of *this* benchmark product (independent of Node/Next versions) |

---

## 3. Policy Aliases

### 3.1 Node.js

| Alias | Selection rule |
|-------|----------------|
| `lts-active` | Current Active LTS line’s latest minor/patch at resolution time (**default** for the suite runtime and default Docker images) |
| `lts-maintenance` | Oldest still-maintained LTS (for compatibility matrices) |
| `current` | Latest Current (non-LTS) release — opt-in profiles only |
| `exact:<semver>` | Explicit pin when reproducing a published result |

**Prefer LTS** for default profiles and CI.

### 3.2 Package managers

| Tool | Default policy |
|------|----------------|
| npm | Version shipped with the resolved Node.js (via official Node distribution) |
| pnpm | Latest stable release available via Corepack or upstream at resolution time |
| Yarn | Latest stable **modern** Yarn (Berry) unless a profile explicitly requests Classic for regression studies |

Corepack is the preferred activation mechanism when available.

### 3.3 Frameworks & languages in fixtures

| Package | Default policy |
|---------|----------------|
| `typescript` | Latest stable |
| `next` | Latest stable production release |
| `react` / `react-dom` | Versions required by the resolved Next.js release (do not freelancing mismatch) |
| `eslint` / related | Latest stable compatible with the fixture |

Fixtures may use `exact:` pins after calibration so digests remain stable within a suite minor version.

### 3.4 Docker base images

| Alias | Rule |
|-------|------|
| `node-lts-bookworm` | Official Node image, Active LTS, Debian Bookworm (or current Debian stable codename at implementation time if Bookworm is superseded) |
| `node-lts-bookworm-slim` | Slim variant of the above |
| `exact:<image@digest>` | Reproduce published Docker results |

Always record resolved image digest in fingerprints when the daemon provides it.

---

## 4. Resolution Timing

| Event | What gets resolved |
|-------|--------------------|
| Suite development kickoff | Toolchain choices for local dev and CI |
| Profile calibration / release | Pins written into built-in fixture `package.json` templates or a `resolved-versions.json` map |
| Each benchmark run | Verify installed binaries; record actual versions; optionally re-resolve if profile uses floating aliases |

**Recommendation:** Built-in profiles used for public comparison should ship with **pinned** fixture dependencies for digest stability, refreshed deliberately on a schedule (see §7). Floating aliases are fine for exploratory profiles.

---

## 5. Suite Semver Policy

The benchmark suite itself follows semantic versioning:

| Bump | When |
|------|------|
| **MAJOR** | Incompatible profile/report schema changes; removal of profile ids without alias |
| **MINOR** | New profiles, collectors, templates; backward-compatible schema additions |
| **PATCH** | Bugfixes, docs, pin refreshes that do not change schema |

Profile `schemaVersion` and artifact `schemaVersion` integers increment separately from suite semver but are announced in the changelog.

---

## 6. Reproducing Historical Results

To reproduce a published run:

1. Check out the suite commit cited in the report.
2. Use the same profile digest.
3. Install toolchains matching `environment.toolchains` from `run.json` (`exact:` pins).
4. Prefer the same OS major and similar CPU/storage class; expect variance otherwise.

The suite provides `jsbench replay <runDir|--from run.json>` for toolchain/profile reproduction hints, and `jsbench replay --execute` to re-run when the local profile digest still matches (use `--force` to override a mismatch).

---

## 7. Refresh Cadence

| Cadence | Action |
|---------|--------|
| Every suite minor release | Re-resolve and PR pin updates for built-in fixtures |
| Security advisories | Out-of-band pin bumps |
| Node LTS transition | Update default `lts-active` targets and CI images |

Pin refresh PRs must note expected digest changes and re-baseline golden tests.

Generator `policy:*` dependency specs are resolved at materialize time from the offline map `templates/resolved-versions.json` (`createPinResolver`). That file is the suite-owned pin set for templates until a network-backed resolver lands.

---

## 8. What Documentation Must Not Do

- Must not present a specific Node/Next/pnpm version as the eternal project requirement.
- Must not instruct contributors to “always install Node 22.x” without stating it as an example of a resolved LTS at a point in time.
- Must describe **aliases and rules** instead.

---

## 9. Implementation Hook

```typescript
interface VersionResolver {
  resolveNode(policy: string): Promise<ResolvedBinary>;
  resolveNpmPackage(name: string, policy: string): Promise<string>; // semver
  resolveDockerImage(policy: string): Promise<{ ref: string; digest?: string }>;
}
```

Resolution backends may use `npm view`, Node dist indexes, Corepack, and Docker Hub/registry APIs—subject to [11_DEPENDENCY_POLICY.md](11_DEPENDENCY_POLICY.md).

---

## 10. Related Documents

- Dependencies: [11_DEPENDENCY_POLICY.md](11_DEPENDENCY_POLICY.md)
- Docker images: [06_DOCKER_BENCHMARK.md](06_DOCKER_BENCHMARK.md)
- Generator pinning: [04_GENERATOR_ENGINE.md](04_GENERATOR_ENGINE.md)
