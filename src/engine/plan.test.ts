import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BenchmarkProfile } from "../profiles/types.js";
import { encodeCellId, expandMatrixCells } from "./expand-matrix.js";
import { createRunPlan } from "./plan.js";

function sampleProfile(overrides: Partial<BenchmarkProfile> = {}): BenchmarkProfile {
  return {
    schemaVersion: 1,
    id: "planner-sample",
    workload: { template: "node-ts-lib", size: "tiny" },
    stages: [{ id: "build", action: "project.build", cache: "cold" }],
    iterations: { warmup: 1, measured: 3 },
    runner: { type: "native" },
    ...overrides,
  };
}

describe("encodeCellId", () => {
  it("uses default for empty axes", () => {
    assert.equal(encodeCellId({}), "default");
  });

  it("encodes sorted axes stably", () => {
    assert.equal(
      encodeCellId({ runner: "native", packageManager: "npm" }),
      "packagemanager-npm__runner-native",
    );
  });
});

describe("expandMatrixCells", () => {
  it("returns a default cell when matrix is omitted", () => {
    const cells = expandMatrixCells(undefined);
    assert.equal(cells.length, 1);
    assert.equal(cells[0]?.cellId, "default");
  });

  it("accepts a single-cell matrix", () => {
    const cells = expandMatrixCells({ packageManager: ["pnpm"] });
    assert.equal(cells.length, 1);
    assert.equal(cells[0]?.cellId, "packagemanager-pnpm");
    assert.deepEqual(cells[0]?.axes, { packageManager: "pnpm" });
  });

  it("expands multi-cell cartesian products", () => {
    const cells = expandMatrixCells({
      packageManager: ["npm", "pnpm"],
      size: ["tiny"],
    });
    assert.equal(cells.length, 2);
    assert.deepEqual(cells.map((c) => c.cellId).sort(), [
      "packagemanager-npm__size-tiny",
      "packagemanager-pnpm__size-tiny",
    ]);
  });

  it("expands two axes into a full product", () => {
    const cells = expandMatrixCells({
      packageManager: ["npm", "pnpm"],
      runner: ["native", "docker"],
    });
    assert.equal(cells.length, 4);
  });
});

describe("createRunPlan", () => {
  it("builds a plan for a profile without matrix", () => {
    const profile = sampleProfile();
    const plan = createRunPlan({
      profile,
      profileDigest: "abc",
      runId: "fixed-run-id",
    });

    assert.equal(plan.runId, "fixed-run-id");
    assert.equal(plan.profileDigest, "abc");
    assert.equal(plan.iterations, 3);
    assert.equal(plan.warmup, 1);
    assert.equal(plan.cells.length, 1);
    assert.equal(plan.stages.length, 1);
    assert.equal(plan.stages[0]?.id, "build");
    assert.equal(plan.stages[0]?.cache, "cold");
  });

  it("dry-run snapshot shape stays stable for single-cell matrix", () => {
    const profile = sampleProfile({
      matrix: { packageManager: ["npm"] },
    });
    const plan = createRunPlan({
      profile,
      profileDigest: "digest-1",
      runId: "run-1",
    });

    assert.deepEqual(
      {
        runId: plan.runId,
        profileDigest: plan.profileDigest,
        cells: plan.cells,
        stages: plan.stages.map((s) => ({ id: s.id, action: s.action, cache: s.cache })),
        iterations: plan.iterations,
        warmup: plan.warmup,
      },
      {
        runId: "run-1",
        profileDigest: "digest-1",
        cells: [{ cellId: "packagemanager-npm", axes: { packageManager: "npm" } }],
        stages: [{ id: "build", action: "project.build", cache: "cold" }],
        iterations: 3,
        warmup: 1,
      },
    );
  });
});
