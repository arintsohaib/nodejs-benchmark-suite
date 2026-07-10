# Built-in benchmark profiles

Official profiles ship under this directory. Descriptions are tagged with a **tier**:

| Tier tag | Meaning | Default CI |
|----------|---------|------------|
| `[smoke]` | Fast path (often install + typecheck, or fixture-only) | Dry-run OK; some execute in CI |
| `[benchmark]` | Standard publishable matrix (includes build where applicable) | Dry-run only |
| `[benchmark-slow]` | Larger size / more PMs / more iterations | Never |

Reports label the same tiers as `Profile tier: …` in Markdown/HTML (derived from profile id).

## Catalog

### Core / legacy

| Id | Tier | Template | Notes |
|----|------|----------|-------|
| `native-smoke` | smoke | `fixtures/native-smoke` | Trivial Node script; default CI execute |
| `docker-smoke` | smoke | `fixtures/native-smoke` | Docker bind-mount; optional CI |
| `install-build-matrix` | benchmark | `node-ts-lib` | npm+pnpm install+build |
| `foundation-sample` | custom | `node-ts-lib` | Helper for dry-run / loading only |

### Next.js (`nextjs-app`)

| Id | Tier | Size | Stages | PMs |
|----|------|------|--------|-----|
| `nextjs-app-smoke` | smoke | tiny | install + typecheck | pnpm |
| `nextjs-app-benchmark` | benchmark | tiny | install + typecheck + build | npm, pnpm |
| `nextjs-app-benchmark-slow` | benchmark-slow | small | install + typecheck + build | npm, pnpm, yarn |

### Next.js + Tailwind (`nextjs-app-tailwind`)

| Id | Tier | Size | Stages | PMs |
|----|------|------|--------|-----|
| `nextjs-app-tailwind-smoke` | smoke | tiny | install + typecheck | pnpm |
| `nextjs-app-tailwind-benchmark` | benchmark | tiny | install + typecheck + build | npm, pnpm |
| `nextjs-app-tailwind-benchmark-slow` | benchmark-slow | small | install + typecheck + build | npm, pnpm, yarn |

### pnpm workspace (`pnpm-workspace`)

Template supports **pnpm only**.

| Id | Tier | Size | Stages | PMs |
|----|------|------|--------|-----|
| `pnpm-workspace-smoke` | smoke | tiny | install + typecheck | pnpm |
| `pnpm-workspace-benchmark` | benchmark | tiny | install + typecheck + build | pnpm |
| `pnpm-workspace-benchmark-slow` | benchmark-slow | small | install + typecheck + build | pnpm |

## Methodology notes

- Install stages are labeled `network: true` and use `cache: cold`.
- Compare only runs with the **same profile digest** (see `calibrated-digests.json`).
- `next build` profiles are intentionally **not** default CI; use local/lab machines.
- List profiles: `pnpm jsbench list-profiles` (alias: `list`; add `--json` for scripts)
- Dry-run any profile: `pnpm jsbench run --profile <id> --dry-run`
