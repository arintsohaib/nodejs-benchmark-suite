# `pnpm-workspace` template

Multi-package TypeScript workspace using pnpm workspaces.

- Skeleton: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Generated: `packages/pkg-NNN/` libraries (`packageCount` × `fileCount` modules)
- Later packages depend on the previous via `workspace:*` for a realistic graph
- Dependency pins: `policy:*` → `templates/resolved-versions.json` (root + packages)

**CI policy:** snapshot/digest tests only for `tiny`. Do not run recursive install/build in default CI.
