import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

describe("jsbench report", () => {
  it("re-renders summary.md and index.html from run.json", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "jsbench-report-cmd-"));
    try {
      const raw = await readFile(SAMPLE, "utf8");
      await writeFile(join(outDir, "run.json"), raw);
      const code = await runCli(["report", outDir, "--log-level", "error"]);
      assert.equal(code, 0);
      const summary = await readFile(join(outDir, "summary.md"), "utf8");
      const html = await readFile(join(outDir, "index.html"), "utf8");
      assert.match(summary, /## Citation/);
      assert.match(html, /<!DOCTYPE html>/);
      // run.json unchanged
      const after = await readFile(join(outDir, "run.json"), "utf8");
      assert.equal(after, raw);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("writes diff.md and diff.json for two runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-diff-cmd-"));
    try {
      const leftDir = join(root, "left");
      const rightDir = join(root, "right");
      const outDir = join(root, "out");
      await mkdir(leftDir);
      await mkdir(rightDir);
      const left = JSON.parse(await readFile(SAMPLE, "utf8")) as RunArtifact;
      const right: RunArtifact = {
        ...left,
        runId: "right-run",
        aggregates: left.aggregates.map((a) =>
          a.stageId === "install" ? { ...a, stats: { ...a.stats, median: 90 } } : a,
        ),
      };
      await writeFile(join(leftDir, "run.json"), `${JSON.stringify(left)}\n`);
      await writeFile(join(rightDir, "run.json"), `${JSON.stringify(right)}\n`);
      const code = await runCli([
        "report",
        "diff",
        leftDir,
        rightDir,
        "--out",
        outDir,
        "--log-level",
        "error",
      ]);
      assert.equal(code, 0);
      const md = await readFile(join(outDir, "diff.md"), "utf8");
      const json = JSON.parse(await readFile(join(outDir, "diff.json"), "utf8")) as {
        leftRunId: string;
        rightRunId: string;
        rows: unknown[];
      };
      assert.match(md, /Report Diff/);
      assert.equal(json.leftRunId, left.runId);
      assert.equal(json.rightRunId, "right-run");
      assert.ok(json.rows.length >= 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
