import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli.js";
import type { RunArtifact } from "../reporting/types.js";

const SAMPLE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../reporting/fixtures/sample-run.json",
);

describe("jsbench replay", () => {
  it("prints a reproduction plan from run.json (hints mode)", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "jsbench-replay-hints-"));
    try {
      await writeFile(join(outDir, "run.json"), await readFile(SAMPLE, "utf8"));
      const code = await runCli(["replay", outDir, "--log-level", "error"]);
      assert.equal(code, 0);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("rejects --execute when the historical profile digest does not match", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "jsbench-replay-mismatch-"));
    try {
      const left = JSON.parse(await readFile(SAMPLE, "utf8")) as RunArtifact;
      const artifact: RunArtifact = {
        ...left,
        profile: {
          id: "native-smoke",
          digest: "not-the-real-digest",
          path: "profiles/native-smoke.yaml",
        },
      };
      await writeFile(join(outDir, "run.json"), `${JSON.stringify(artifact)}\n`);
      const code = await runCli([
        "replay",
        "--from",
        outDir,
        "--execute",
        "--log-level",
        "error",
        "--workspace-root",
        join(outDir, "generated"),
        "--output-dir",
        join(outDir, "reports"),
      ]);
      assert.equal(code, 2);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("re-executes when the historical profile digest still matches", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "jsbench-replay-exec-"));
    try {
      const first = await runCli([
        "run",
        "--profile",
        "native-smoke",
        "--log-level",
        "error",
        "--workspace-root",
        join(outDir, "generated"),
        "--output-dir",
        join(outDir, "reports"),
      ]);
      assert.equal(first, 0);
      const runs = await readdir(join(outDir, "reports"));
      assert.ok(runs.length >= 1);
      const runDir = join(outDir, "reports", runs[0] as string);

      const code = await runCli([
        "replay",
        runDir,
        "--execute",
        "--log-level",
        "error",
        "--workspace-root",
        join(outDir, "generated-replay"),
        "--output-dir",
        join(outDir, "reports-replay"),
      ]);
      assert.equal(code, 0);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
