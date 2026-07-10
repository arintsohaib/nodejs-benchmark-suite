import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isBenchError } from "../errors/bench-error.js";
import { renderTemplateTree } from "./render.js";
import type { LoadedTemplate } from "./types.js";

const workspaceTemplate: LoadedTemplate = {
  rootDir: join(process.cwd(), "templates", "pnpm-workspace"),
  manifest: {
    schemaVersion: 1,
    id: "pnpm-workspace",
    title: "test",
    supports: { sizes: ["tiny"] },
    produces: { kind: "workspace" },
  },
};

describe("renderWorkspaceTree", () => {
  it("rejects packageCount < 1", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-ws-bad-"));
    try {
      await assert.rejects(
        () =>
          renderTemplateTree({
            template: workspaceTemplate,
            workspacePath: join(root, "ws"),
            params: {
              size: "tiny",
              seed: 1,
              fileCount: 2,
              packageCount: 0,
              tsComplexity: 1,
              extras: {},
            },
          }),
        (error: unknown) =>
          isBenchError(error) &&
          error.code === "VALIDATION_ERROR" &&
          /packageCount >= 1/.test(error.message),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
