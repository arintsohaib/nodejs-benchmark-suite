# Hardware Validation Plan — before final `1.1.0`

**Applies to:** suite `1.1.0-rc.1` and later RCs until `1.1.0`  
**Goal:** Confirm methodology honesty and operational reliability across real machines—not to crown hardware winners.  
**Companion:** [19_RELEASE_CANDIDATE_CHECKLIST.md](19_RELEASE_CANDIDATE_CHECKLIST.md)

---

## 1. Rules for all classes

1. Record **suite version**, **profile id + digest**, **OS**, **CPU model**, **RAM**, **storage type** (HDD/SSD/NVMe), and whether the run was **native** or **Docker**.
2. Prefer a quiet machine (minimal background load); note if thermal throttling is likely.
3. Use the same Node major (20+) and put **pnpm on PATH** (README first-time setup).
4. Attach or archive `run.json` for every cited run.
5. Compare only runs with the **same profile digest**.
6. Do **not** publish “X is faster than Y” without matching methodology (cold/warm, network, mount mode).

**Minimum bar to promote RC → final:** at least **three** hardware classes below complete the **Tier A** set successfully; at least **one** class completes **Tier B**.

---

## 2. Profile tiers for this plan

| Tier | Profiles | Intent |
|------|----------|--------|
| **A — Smoke / gate** | `native-smoke`, `install-build-matrix` (dry-run + full if network), `pnpm jsbench doctor`, `list-profiles` | Correctness + install path |
| **B — Standard lab** | `nextjs-app-smoke`, `nextjs-app-benchmark`, `pnpm-workspace-smoke`, `pnpm-workspace-benchmark` | Realistic install/typecheck/build |
| **C — Optional heavy** | `nextjs-app-tailwind-benchmark`, `*-benchmark-slow` (needs time + Yarn for Yarn cells), `docker-smoke` | Stress / Docker / multi-PM |
| **D — Reporting** | `report`, `report diff` (two consecutive smokes), `replay --execute`, `leaderboard` | Artifact pipeline |

Always run **D** on at least one machine after A.

---

## 3. By hardware class

### 3.1 Low-end mini PCs (e.g. N100/N95, ≤16 GiB RAM, SATA or entry NVMe)

| Recommend | Profiles | Notes |
|-----------|----------|--------|
| Required | Tier **A** + **D** | Expect long Next builds; raise patience, not concurrency |
| Strongly recommended | `nextjs-app-smoke`, `pnpm-workspace-smoke` | Avoid running two Next builds at once |
| Optional | `nextjs-app-benchmark` (single PM cell if needed via custom profile later—or accept 10–30+ min) | Watch memory during `next build` |
| Skip / defer | Full `*-benchmark-slow` with 3 PMs × 3 iterations | Too long for RC feedback loops |

**Success:** smoke + matrix complete; reports readable; no OOM.

### 3.2 Consumer desktops (mainstream Ryzen/Intel, 16–32 GiB, NVMe)

| Recommend | Profiles |
|-----------|----------|
| Required | Tier **A** + **B** + **D** |
| Recommended | `nextjs-app-tailwind-benchmark`, `docker-smoke` if Docker installed |
| Optional | One `*-benchmark-slow` (pnpm-only workspace slow is enough) |

**Success:** Tier B completes with stable digests; Docker smoke matches native fixture behavior qualitatively.

### 3.3 High-end workstations (HEDT / Threadripper-class, ≥64 GiB, fast NVMe)

| Recommend | Profiles |
|-----------|----------|
| Required | Tier **A** + **B** + **D** |
| Recommended | Full Tier **C** including at least one `*-benchmark-slow` with npm+pnpm+yarn if Yarn available |
| Optional | Parallel lab: two profiles sequentially with cold caches; document cache policy |

**Success:** Slow tiers finish; variance notes recorded (do not over-interpret absolute ms).

### 3.4 VPS providers (shared/burstable vCPU, often remote SSD)

| Recommend | Profiles |
|-----------|----------|
| Required | Tier **A** + **D** |
| Recommended | `nextjs-app-smoke`, `pnpm-workspace-benchmark` |
| Caution | `nextjs-app-benchmark` on small plans (1–2 vCPU / 2 GiB) may OOM or throttle |
| Optional | `docker-smoke` if nested virt / Docker allowed |

**Success:** Document provider, plan size, and any steal-time / noisy-neighbor effects in notes. Prefer dedicated vCPU plans for publishable numbers.

### 3.5 Dedicated servers (bare metal colo / rented dedicated)

| Recommend | Profiles |
|-----------|----------|
| Required | Tier **A** + **B** + **D** |
| Recommended | Tier **C** including Docker bind vs named-volume comparison checklist ([06_DOCKER_BENCHMARK.md](06_DOCKER_BENCHMARK.md) §14) |
| Optional | Repeat Tier B after reboot (cold disk caches) |

**Success:** Native vs Docker methodology notes filled; digests match built-ins.

### 3.6 Virtual machines (local KVM/QEMU, cloud custom images)

| Recommend | Profiles |
|-----------|----------|
| Required | Tier **A** + **D** on a clean image following README first-time setup |
| Recommended | Tier **B** if ≥4 GiB guest RAM |
| Focus | First-time UX: Corepack/pnpm PATH, `doctor`, Node ≥20 |

**Success:** A new user path works without undocumented steps; `doctor` required checks pass.

---

## 4. Suggested session script (copy/adapt)

```bash
# After first-time setup (Node ≥20, pnpm on PATH):
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build

pnpm jsbench doctor
pnpm jsbench list-profiles
pnpm jsbench run --profile native-smoke
pnpm jsbench run --profile install-build-matrix   # needs network + npm + pnpm

# Reporting pipeline
pnpm jsbench run --profile native-smoke
pnpm jsbench report diff ./reports/<runA> ./reports/<runB> --out ./diff-out
pnpm jsbench replay ./reports/<runA> --execute
pnpm jsbench leaderboard --from ./reports --out ./leaderboard

# Lab (when time/hardware allow)
pnpm jsbench run --profile nextjs-app-smoke
pnpm jsbench run --profile nextjs-app-benchmark
pnpm jsbench run --profile pnpm-workspace-benchmark
pnpm jsbench run --profile docker-smoke            # if Docker available
```

Archive `reports/`, `diff-out/`, and `leaderboard/` with a short `NOTES.md` (hardware class + anomalies).

---

## 5. What to file back

For each machine, open an issue or PR comment with:

- Hardware class (from §3)
- `pnpm jsbench version` output
- Profile digests used
- Pass/fail per tier
- Failures: stage log tails + `run.json` status
- Any doc/UX confusion (onboarding regressions)

Do **not** block final `1.1.0` on absolute performance rankings—block on crashes, wrong digests, broken install path, or methodology bugs.
