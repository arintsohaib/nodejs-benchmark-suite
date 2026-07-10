# Coding Standard

**Status:** Planning  
**Last updated:** July 2026

---

## 1. Scope

Applies to all first-party TypeScript/JavaScript in this repository once implementation begins, plus Markdown specs under `docs/`.

---

## 2. Language & Style

- **TypeScript** for suite code; `strict` compiler options enabled.
- Target a modern Node.js Active LTS API surface per [09_VERSION_POLICY.md](09_VERSION_POLICY.md).
- Prefer `async`/`await` over raw callbacks.
- Prefer named exports for libraries; default export only for CLI entry.
- Avoid `any`; use `unknown` + narrowing.
- No non-null assertions unless justified with a comment.

### Formatting & lint

- **Biome** for format + lint (locked in [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md); do not mix with Prettier unless the decision log is updated).
- CI fails on format/lint drift.
- Editor settings may live under `.vscode/` as recommendations only.

---

## 3. Project Structure Rules

- Respect module boundaries in [03_ARCHITECTURE.md](03_ARCHITECTURE.md).
- No deep imports across package internals (`@scope/pkg/src/...` forbidden).
- Public APIs export from package `index.ts` only.
- Side-effect imports discouraged except for CLI bootstrap.

---

## 4. Naming

| Kind | Convention |
|------|------------|
| Files | `kebab-case.ts` (locked — see [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md)) |
| Types / Classes | `PascalCase` |
| Functions / vars | `camelCase` |
| Constants | `SCREAMING_SNAKE` only for true constants |
| Profile ids | `kebab-case` |
| Metric names | `camelCase` |

---

## 5. Error Handling

- Throw typed errors (`BenchError` hierarchy) with `code` strings.
- Map error codes to process exit codes at the CLI edge only.
- Never swallow errors silently; log context at failure boundaries.
- Prefer failing validation early (profiles, doctor).

---

## 6. Process Execution

- Use argv arrays; `shell: true` is forbidden in default paths.
- Always set `cwd` explicitly for workspace commands.
- Clear timeouts; kill process groups on timeout.
- Capture stdout/stderr to files for timed stages.

---

## 7. Testing Standards

- Unit tests colocated as `src/**/*.test.ts`; integration tests under `tests/` (locked in [17_IMPLEMENTATION_PLAN.md](17_IMPLEMENTATION_PLAN.md)).
- Test names describe behavior: `plans matrix product for pm × runner`.
- No network in default unit tests; mock resolvers.
- Mark Docker tests with `docker` / `slow` tags.

---

## 8. Documentation Standards

- Specs are authoritative; code comments explain *why*, not restate *what*.
- Use Mermaid for diagrams.
- Keep language precise; avoid marketing tone in docs.
- Update changelog for user-visible changes.
- When editing schemas, update the corresponding `docs/` page in the same PR.
- Do not leave `TODO` placeholders in published specs; use roadmap/tasks instead.

### Markdown style

- ATX headings (`#`, `##`)
- Wrap tables for readability when practical
- Link related docs relatively (`[Architecture](03_ARCHITECTURE.md)`)
- Code fences with language tags

---

## 9. Commits & PRs (guidance)

- Imperative commit subjects: `Add profile schema validator`
- Small PRs preferred; schema changes isolated when possible
- PR description links to task ids from [13_TASKS.md](13_TASKS.md)
- AI agents: one slice per turn and stop for review — [../AGENTS.md](../AGENTS.md)

---

## 10. Security Hygiene

- No secrets in repo; `.env` gitignored
- Redact sensitive env in reports
- Depend on lockfiles for the suite itself
- Review new dependencies per [11_DEPENDENCY_POLICY.md](11_DEPENDENCY_POLICY.md)

---

## 11. Performance Hygiene (suite code)

- Avoid blocking the event loop with sync FS on large trees when async is feasible
- Don’t hold entire stage logs in memory if streamed to disk
- Benchmark the suite’s own overhead occasionally on long stages

---

## 12. Forbidden Patterns

- Hardcoded “current” version numbers in docs as eternal requirements
- Hidden network calls inside collectors during unit tests
- Sharing mutable global state between matrix cells
- Writing into the operator’s home package caches unless profile opts in
