/**
 * Optional slow network install matrix (not in default CI).
 * Run: `JSBENCH_SLOW_TESTS=1 pnpm test:slow`
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runCli } from "../../cli.js";
import { ExitCode } from "../../errors/bench-error.js";
import { resolveOnPath } from "../../runners/native/discover.js";

const enabled = process.env["JSBENCH_SLOW_TESTS"] === "1";
const hasNpm = resolveOnPath("npm") !== undefined;
const hasPnpm = resolveOnPath("pnpm") !== undefined;

describe("slow install-build-matrix (optional)", { skip: !enabled }, () => {
  it("runs npm+pnpm install+build on node-ts-lib tiny when tools exist", async (t) => {
    if (!hasNpm || !hasPnpm) {
      t.skip("requires npm and pnpm on PATH");
      return;
    }
    const root = await mkdtemp(join(tmpdir(), "jsbench-slow-"));
    try {
      const code = await runCli([
        "run",
        "--profile",
        "install-build-matrix",
        "--output-dir",
        join(root, "reports"),
        "--workspace-root",
        join(root, "generated"),
        "--log-level",
        "warn",
      ]);
      assert.equal(code, ExitCode.Success);
      const runs = await readdir(join(root, "reports"));
      assert.equal(runs.length, 1);
      const runId = runs[0];
      assert.ok(runId);
      const runJson = JSON.parse(
        await readFile(join(root, "reports", runId, "run.json"), "utf8"),
      ) as { status: string; plan: { cellCount: number }; results: unknown[] };
      assert.equal(runJson.status, "completed");
      assert.equal(runJson.plan.cellCount, 2);
      assert.ok(runJson.results.length >= 4);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
