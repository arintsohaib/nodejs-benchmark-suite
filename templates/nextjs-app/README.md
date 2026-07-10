# `nextjs-app` template

Next.js App Router + TypeScript workload.

- Skeleton: App Router layout/home, `next.config.mjs`, TS config
- Generated: `app/gen/pNNN/page.tsx` plus a seed-aware home route index
- Dependency pins: `policy:*` → `templates/resolved-versions.json` at generation

**CI policy:** snapshot/digest tests only for `tiny`. Do not run `next build` in default CI (S11).
