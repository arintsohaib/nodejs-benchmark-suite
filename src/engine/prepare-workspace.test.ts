import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { BenchmarkProfile } from "../profiles/types.js";
import { prepareWorkspace } from "./prepare-workspace.js";

function minimalProfile(template: string): BenchmarkProfile {
  return {
    schemaVersion: 1,
    id: "test",
    workload: { template },
    stages: [{ id: "s", action: "raw.command", command: "node", args: ["-e", "0"] }],
    iterations: { measured: 1 },
  };
}

describe("prepareWorkspace", () => {
  it("copies a static fixture directory into an empty workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-ws-"));
    try {
      const fixture = join(root, "fixtures", "demo");
      await mkdir(fixture, { recursive: true });
      await writeFile(join(fixture, "index.js"), "console.log('hi')\n", "utf8");
      const workspace = join(root, "workspace");
      const result = await prepareWorkspace({
        workspacePath: workspace,
        profile: minimalProfile("fixtures/demo"),
        cwd: root,
      });
      assert.equal(result.seededFrom, fixture);
      const body = await readFile(join(workspace, "index.js"), "utf8");
      assert.match(body, /hi/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("materializes a generator template id into the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-ws-gen-"));
    try {
      const workspace = join(root, "workspace");
      const result = await prepareWorkspace({
        workspacePath: workspace,
        profile: {
          ...minimalProfile("node-ts-lib"),
          workload: { template: "node-ts-lib", size: "tiny", seed: 1 },
        },
        cwd: root,
      });
      assert.equal(result.mode, "generated");
      assert.equal(result.seededFrom, "template:node-ts-lib");
      assert.match(result.contentDigest ?? "", /^[a-f0-9]{64}$/);
      const pkg = await readFile(join(workspace, "package.json"), "utf8");
      assert.match(pkg, /node-ts-lib/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("leaves an empty workspace when template is unknown", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-ws-empty-"));
    try {
      const workspace = join(root, "workspace");
      const result = await prepareWorkspace({
        workspacePath: workspace,
        profile: minimalProfile("not-a-real-template-xyz"),
        cwd: root,
      });
      assert.equal(result.seededFrom, undefined);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
