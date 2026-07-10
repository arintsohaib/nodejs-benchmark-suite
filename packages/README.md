# Deferred monorepo packages

The suite currently ships as a **single package** under `src/` (locked decision in
`docs/17_IMPLEMENTATION_PLAN.md`).

This directory is reserved for a future split into `packages/*` (cli, core, runners, …)
if module boundaries become painful. Do not add publishable packages here until that
decision is revisited in the decisions log.
