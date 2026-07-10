# native-smoke fixture

Static tree used by [`profiles/native-smoke.yaml`](../profiles/native-smoke.yaml) until the generator (M2) materializes workloads from templates.

The engine copies this directory into the run workspace, then executes `node index.js` via `raw.command`.
