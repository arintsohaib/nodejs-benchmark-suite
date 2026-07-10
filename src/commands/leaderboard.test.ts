import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli.js";
import { isValidLeaderboard } from "../reporting/validate-leaderboard.js";

const SAMPLE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../reporting/fixtures/sample-run.json",
);

describe("jsbench leaderboard", () => {
  it("indexes run directories into leaderboard.json + leaderboard.md", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-lb-"));
    try {
      const runDir = join(root, "reports", "run-1");
      await mkdir(runDir, { recursive: true });
      await writeFile(join(runDir, "run.json"), await readFile(SAMPLE, "utf8"));
      const outDir = join(root, "leaderboard-out");
      const code = await runCli([
        "leaderboard",
        "--from",
        join(root, "reports"),
        "--out",
        outDir,
        "--log-level",
        "error",
      ]);
      assert.equal(code, 0);
      const json = JSON.parse(await readFile(join(outDir, "leaderboard.json"), "utf8")) as unknown;
      assert.equal(isValidLeaderboard(json), true);
      const md = await readFile(join(outDir, "leaderboard.md"), "utf8");
      assert.match(md, /local leaderboard/);
      assert.match(md, /Not a ranking/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
