# Contributing

**Last updated:** July 2026  
**Status:** `1.1.0-rc.1` prepared; final `1.1.0` after hardware validation  

Thank you for helping build a trustworthy JS development benchmark platform.

**AI agents:** use [../AGENTS.md](../AGENTS.md) as the operating manual (reading order, one-milestone rule, Definition of Done). This guide is primarily for human contributors; norms overlap.

---

## 1. Code of Conduct

Be respectful and assume good faith. Harassment or personal attacks are not tolerated. Maintainers may refuse reviews that ignore methodology honesty (e.g. proposals to hide network time or silently drop outliers).

---

## 2. Ways to Contribute

| Area | When | Examples |
|------|------|----------|
| Documentation | Always | Clarify specs, fix inconsistencies, improve diagrams |
| Design discussion | Always | Issues proposing schema changes |
| Implementation | Open (from S4) | Engine, runners, generators, reporters — one slice at a time per [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md) |
| Profiles / templates | From M2 | New workloads following contracts |
| Plugins | From M5 | Collectors/reporters |

---

## 3. Spec-First Rule

1. Read [03_ARCHITECTURE.md](03_ARCHITECTURE.md) and related subsystem docs before coding.
2. Keep module boundaries intact.
3. Update docs in the same PR when behavior or schemas change.
4. Add tests for planner/schema/generator/config changes.
5. Prefer issues linked to [13_TASKS.md](13_TASKS.md) for scope questions.
6. Ship **one implementation slice** per PR when practical; do not bundle unrelated milestones.

---

## 4. Development Setup

**Node.js ≥ 20** is required. Put **pnpm** on your `PATH` (see README “First-time setup (Linux)” for a rootless Corepack recipe).

```bash
git clone <repo-url>
cd nodejs-benchmark-suite
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm jsbench doctor
pnpm jsbench list-profiles
pnpm jsbench run --profile native-smoke
```

Invoke the CLI as **`pnpm jsbench <command>`** from a clone (or `node dist/cli.js <command>` after `pnpm build`). Do not assume a global `jsbench` binary.

Optional network matrix (not in default CI):

```bash
JSBENCH_SLOW_TESTS=1 pnpm test:slow
# or
pnpm jsbench run --profile install-build-matrix
```

Optional Docker smoke (requires Docker daemon):

```bash
pnpm jsbench run --profile docker-smoke
```

---

## 5. Pull Request Checklist

- [ ] Task id referenced (e.g. `T-M1-03`)
- [ ] Tests added/updated when appropriate
- [ ] Docs updated when schemas/CLI change
- [ ] Changelog entry under `[Unreleased]` for user-visible changes
- [ ] No secrets or generated `node_modules` committed
- [ ] Methodology impact called out (cold/warm, network, mounts)

---

## 6. Adding a Profile (from M2)

1. Create YAML under `profiles/`.
2. Validate with `pnpm jsbench validate-profile <id>`.
3. Document intent in profile `description`.
4. Prefer pinned fixture deps for built-in profiles.
5. Include expected stages and matrix axes explicitly.

---

## 7. Adding a Template

Follow the contract in [04_GENERATOR_ENGINE.md](04_GENERATOR_ENGINE.md):

- Provide `template.manifest.yaml`
- No vendored `node_modules`
- Deterministic renders for fixed seeds
- Digest tests for `tiny` size

---

## 8. Adding a Plugin (from M5 / S15)

In-process plugins are local ESM modules listed under `plugins` in `jsbench.config.yaml`:

```yaml
plugins:
  - ./examples/plugins/sample-note-reporter.mjs
```

A plugin default-exports (or exports `plugin`) an object:

```js
export default {
  id: "my-plugin",
  collectors: [/* Collector | () => Collector */],
  reporters: [/* Reporter | () => Reporter */],
};
```

Built-in collector ids: `wall` (always timed by the process/docker runner), `rusage`, `disk-usage`, `docker-stats`. Enable via profile:

```yaml
metrics:
  collectors: [wall, rusage, disk-usage, docker-stats]
```

`docker-stats` only emits samples on Docker stages (needs container context); native runs skip it.
See the sample at [`examples/plugins/sample-note-reporter.mjs`](../examples/plugins/sample-note-reporter.mjs) and [03_ARCHITECTURE.md](03_ARCHITECTURE.md) §9.

---

## 9. Coding Standards

See [10_CODING_STANDARD.md](10_CODING_STANDARD.md) and [11_DEPENDENCY_POLICY.md](11_DEPENDENCY_POLICY.md).

---

## 10. Security Issues

Report security-sensitive bugs privately to the maintainers (email or GitHub Security Advisory once enabled). Do not file public issues for exploit details.

---

## 11. License

By contributing, you agree your contributions are licensed under the MIT License (`LICENSE`).
