# Maintainer scripts

Optional one-off helpers for maintainers. Prefer documenting regeneration steps in [docs/18_SCHEMA_COMPATIBILITY.md](../docs/18_SCHEMA_COMPATIBILITY.md) rather than committing ad-hoc scripts.

To refresh `profiles/calibrated-digests.json` after intentional profile/template/pin changes, materialize tiny templates with fixed `createdAt` and recompute profile digests via `listProfiles`, then update the JSON and changelog.
