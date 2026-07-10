/**
 * Sample jsbench reporter plugin (S15).
 * Writes `plugin-note.txt` beside run artifacts when listed under config `plugins`.
 *
 * @example
 * ```yaml
 * # jsbench.config.yaml
 * plugins:
 *   - ./examples/plugins/sample-note-reporter.mjs
 * ```
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/** @typedef {{ runId: string, status: string, suiteVersion: string }} RunArtifactLite */

export default {
  id: "sample-note-reporter",
  reporters: [
    {
      id: "sample-note",
      /**
       * @param {RunArtifactLite} artifact
       * @param {string} outDir
       */
      async render(artifact, outDir) {
        const body = [
          "jsbench sample plugin note",
          `runId=${artifact.runId}`,
          `status=${artifact.status}`,
          `suiteVersion=${artifact.suiteVersion}`,
          "",
          "This file is produced by examples/plugins/sample-note-reporter.mjs.",
          "",
        ].join("\n");
        await writeFile(join(outDir, "plugin-note.txt"), body, "utf8");
      },
    },
  ],
};
