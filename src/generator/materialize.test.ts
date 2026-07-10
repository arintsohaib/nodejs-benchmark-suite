import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { digestWorkspace } from "./digest.js";
import { materialize } from "./materialize.js";

describe("generator materialize + digest", () => {
  it("produces stable digests across two materializations", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-gen-"));
    try {
      const a = join(root, "a");
      const b = join(root, "b");
      const input = {
        workload: { template: "fixture-lib", size: "tiny" as const, seed: 7 },
        createdAt: "2026-07-11T00:00:00.000Z",
      };
      const refA = await materialize({ ...input, workspacePath: a });
      const refB = await materialize({ ...input, workspacePath: b });
      assert.equal(refA.contentDigest, refB.contentDigest);
      assert.match(refA.contentDigest, /^[a-f0-9]{64}$/);

      const meta = JSON.parse(await readFile(join(a, ".jsbench-workspace.json"), "utf8")) as {
        contentDigest: string;
        templateId: string;
      };
      assert.equal(meta.contentDigest, refA.contentDigest);
      assert.equal(meta.templateId, "fixture-lib");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("changes digest when seed changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-gen-seed-"));
    try {
      const a = await materialize({
        workload: { template: "fixture-lib", size: "tiny", seed: 1 },
        workspacePath: join(root, "s1"),
        createdAt: "2026-07-11T00:00:00.000Z",
      });
      const b = await materialize({
        workload: { template: "fixture-lib", size: "tiny", seed: 2 },
        workspacePath: join(root, "s2"),
        createdAt: "2026-07-11T00:00:00.000Z",
      });
      assert.notEqual(a.contentDigest, b.contentDigest);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores excluded dirs when digesting", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-gen-excl-"));
    try {
      const ws = join(root, "ws");
      await materialize({
        workload: { template: "fixture-lib", size: "tiny", seed: 1 },
        workspacePath: ws,
        createdAt: "2026-07-11T00:00:00.000Z",
      });
      const before = await digestWorkspace(ws);
      await mkdir(join(ws, "node_modules", "pkg"), { recursive: true });
      await writeFile(join(ws, "node_modules", "pkg", "index.js"), "noise\n", "utf8");
      await mkdir(join(ws, ".next"), { recursive: true });
      await writeFile(join(ws, ".next", "trace"), "noise\n", "utf8");
      await writeFile(join(ws, "debug.log"), "noise\n", "utf8");
      const after = await digestWorkspace(ws);
      assert.equal(before, after);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
