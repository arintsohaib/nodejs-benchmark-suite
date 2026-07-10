import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReplayPlan } from "./replay-plan.js";
import type { RunArtifact } from "./types.js";

function sampleArtifact(overrides: Partial<RunArtifact> = {}): RunArtifact {
  return {
    suiteVersion: "1.0.0",
    schemaVersion: 1,
    metricsSchemaVersion: 1,
    runId: "run-1",
    createdAt: "2026-07-11T00:00:00.000Z",
    status: "completed",
    profile: {
      id: "native-smoke",
      digest: "abc",
      path: "profiles/native-smoke.yaml",
    },
    environment: {
      mode: "native",
      os: { platform: "linux", release: "6.1.0", distro: "Debian" },
      cpu: { model: "Test", coresLogical: 4, arch: "x64" },
      memory: { totalBytes: 8 },
      toolchains: {
        node: { path: "/usr/bin/node", version: "v22.1.0" },
        npm: { path: "/usr/bin/npm", version: "10.2.0" },
      },
    },
    plan: { cellCount: 1, stageIds: ["run"], warmup: 0, measured: 1 },
    results: [],
    aggregates: [],
    warnings: [],
    ...overrides,
  };
}

describe("buildReplayPlan", () => {
  it("emits exact: toolchain hints and suggested commands", () => {
    const plan = buildReplayPlan(sampleArtifact());
    assert.equal(plan.sourceRunId, "run-1");
    assert.equal(plan.profile.id, "native-smoke");
    assert.deepEqual(
      plan.environment.toolchains.map((t) => [t.name, t.exactHint]),
      [
        ["node", "exact:22.1.0"],
        ["npm", "exact:10.2.0"],
      ],
    );
    assert.ok(plan.suggestedCommands.some((c) => c.includes("run --profile native-smoke")));
    assert.ok(plan.suggestedCommands.every((c) => c.startsWith("pnpm jsbench")));
    assert.ok(plan.notes.length >= 3);
  });

  it("adds a Docker note for docker-mode artifacts", () => {
    const plan = buildReplayPlan(
      sampleArtifact({
        environment: {
          ...sampleArtifact().environment,
          mode: "docker",
          docker: { imageRef: "node:22", mount: "bind" },
        },
      }),
    );
    assert.ok(plan.notes.some((n) => /Docker/i.test(n)));
    assert.equal(plan.environment.docker?.imageRef, "node:22");
  });
});
