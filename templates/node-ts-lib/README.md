# `node-ts-lib` template

TypeScript library workload for install / typecheck / `tsc` build comparisons.

- Skeleton: `package.json`, `tsconfig.json`, `src/index.ts`, `src/lib/util.ts`
- Generated: `src/generated/mNNN.ts` from size knobs (`fileCount`, `tsComplexity`, `seed`)
- Dependency pins: `policy:*` resolved at generation via `templates/resolved-versions.json`

Do not commit `node_modules` or lockfiles into this template.
