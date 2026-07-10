# `nextjs-app-tailwind` template

Next.js App Router + TypeScript + Tailwind CSS v4 (PostCSS) workload.

- Skeleton: App Router layout/home, `next.config.mjs`, `postcss.config.mjs`, TS config
- Generated: `app/gen/pNNN/page.tsx` plus a seed-aware home route index
- Dependency pins: `policy:*` → `templates/resolved-versions.json` at generation

**CI policy:** snapshot/digest tests only for `tiny`. Do not run `next build` in default CI.
