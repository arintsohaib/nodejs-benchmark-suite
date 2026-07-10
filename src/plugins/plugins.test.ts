import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createDiskUsageCollector } from "../metrics/disk-usage-collector.js";
import { createRusageCollector } from "../metrics/rusage-collector.js";
import type { StageContext } from "../metrics/types.js";
import { loadPluginModule } from "./load-plugin.js";
import { createPluginRegistry } from "./registry.js";

const CTX: StageContext = {
  runId: "t",
  cellId: "c",
  stageId: "s",
  iteration: 1,
  iterationKind: "measured",
  workspacePath: ".",
};

describe("plugin registry", () => {
  it("lists built-in collectors", async () => {
    const registry = await createPluginRegistry({});
    assert.deepEqual(registry.listCollectorIds(), ["disk-usage", "docker-stats", "rusage", "wall"]);
  });

  it("loads a sample reporter plugin from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsbench-plugin-"));
    const pluginPath = join(dir, "note.mjs");
    await writeFile(
      pluginPath,
      `
export default {
  id: "test-note",
  reporters: [{
    id: "test-note-reporter",
    async render(artifact, outDir) {
      const { writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      await writeFile(join(outDir, "note.txt"), artifact.runId, "utf8");
    }
  }]
};
`,
      "utf8",
    );
    const registry = await createPluginRegistry({ pluginPaths: [pluginPath] });
    assert.equal(registry.plugins[0]?.id, "test-note");
    assert.deepEqual(registry.listReporterIds(), ["test-note-reporter"]);
    const out = await mkdtemp(join(tmpdir(), "jsbench-plugin-out-"));
    await registry.createReporter("test-note-reporter").render(
      {
        runId: "run-1",
        status: "completed",
        suiteVersion: "0.0.0",
      } as never,
      out,
    );
    const { readFile } = await import("node:fs/promises");
    assert.equal(await readFile(join(out, "note.txt"), "utf8"), "run-1");
  });

  it("rejects unknown collectors", async () => {
    const registry = await createPluginRegistry({});
    assert.throws(() => registry.createCollector("nope"));
  });
});

describe("loadPluginModule", () => {
  it("loads the examples sample-note-reporter", async () => {
    const path = join(process.cwd(), "examples/plugins/sample-note-reporter.mjs");
    const plugin = await loadPluginModule(path);
    assert.equal(plugin.id, "sample-note-reporter");
    assert.equal(plugin.reporters?.length, 1);
  });
});

describe("rusage collector", () => {
  it("emits cpu and rss samples", async () => {
    const collector = createRusageCollector();
    collector.start(CTX);
    // burn a little CPU
    let x = 0;
    for (let i = 0; i < 100_000; i += 1) {
      x += i;
    }
    assert.ok(x >= 0);
    const samples = await Promise.resolve(collector.stop(CTX));
    const names = samples.map((s) => s.name).sort();
    assert.deepEqual(names, ["cpuSystemMs", "cpuUserMs", "maxRssBytes"]);
    for (const sample of samples) {
      assert.ok(sample.value >= 0);
    }
  });
});

describe("disk-usage collector", () => {
  it("measures workspace size before/after", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsbench-disk-"));
    await writeFile(join(dir, "a.txt"), "hello", "utf8");
    const collector = createDiskUsageCollector();
    const ctx = { ...CTX, workspacePath: dir };
    await collector.start(ctx);
    await writeFile(join(dir, "b.txt"), "world!!!", "utf8");
    const samples = await collector.stop(ctx);
    const byName = Object.fromEntries(samples.map((s) => [s.name, s.value]));
    assert.ok((byName["workspaceBytesBefore"] ?? 0) > 0);
    assert.ok((byName["workspaceBytesAfter"] ?? 0) > (byName["workspaceBytesBefore"] ?? 0));
    assert.ok((byName["workspaceBytesDelta"] ?? 0) > 0);
  });
});
