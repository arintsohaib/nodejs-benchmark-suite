# Benchmark Report — 20260711T000000Z-fixture

> **Partial run** — completed stages are included below; see failed stages and warnings.

## Snapshot

- Suite: 0.1.0-0
- Status: partial
- Profile: `fixture-profile` (digest `abc123digest`)
- Profile tier: custom / unofficial
- Profile path: `profiles/fixture-profile.yaml`
- Runner mode: native
- Iterations: warmup 0, measured 3
- Cells: 1
- Stages: install, build

## Environment

- OS: linux 6.1.0 (Debian GNU/Linux 13 (trixie))
- CPU: Test CPU (4 logical, x64)
- Memory: 8.0 GiB
- Toolchains:
  - node: v22.0.0 (`/usr/bin/node`)
  - npm: 10.0.0 (`/usr/bin/npm`)

## Results

### Stage: build

| Cell | median ms | mean ms | p95 ms | n |
|------|-----------|---------|--------|---|
| default | 50 | 50 | 50 | 1 |

### Stage: install

| Cell | median ms | mean ms | p95 ms | n |
|------|-----------|---------|--------|---|
| default | 110 | 110 | 120 | 3 |

### Failed stages

- `default` / `build` iteration 1 (measured)

## Notes / Warnings

- Stage build failed on iteration 1

## Citation

When citing these results, include at least:

- Suite version: `0.1.0-0`
- Run id: `20260711T000000Z-fixture`
- Profile: `fixture-profile` (digest `abc123digest`, tier: custom / unofficial)
- Runner mode: native
- Hardware / OS summary from the Environment section
- Cold/warm and network policy from the profile stages
- Attach or link the immutable `run.json` for this run

Do not claim package-manager or hardware “winners” from a single run.

