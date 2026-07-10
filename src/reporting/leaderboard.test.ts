import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEADERBOARD_DISCLAIMER,
  buildLeaderboard,
  renderLeaderboardMarkdown,
} from "./leaderboard.js";
import type { RunArtifact } from "./types.js";

function sampleArtifact(overrides: Partial<RunArtifact> = {}): RunArtifact {
  return {
    suiteVersion: "1.0.0",
    schemaVersion: 1,
    metricsSchemaVersion: 1,
    runId: "run-b",
    createdAt: "2026-07-11T00:00:00.000Z",
    status: "completed",
    profile: { id: "native-smoke", digest: "abc", path: "profiles/native-smoke.yaml" },
    environment: {
      mode: "native",
      os: { platform: "linux", release: "6.1.0" },
      cpu: { model: "Test CPU", coresLogical: 4, arch: "x64" },
      memory: { totalBytes: 8 },
      toolchains: { node: { path: "/usr/bin/node", version: "v22.0.0" } },
    },
    plan: { cellCount: 1, stageIds: ["run"], warmup: 0, measured: 1 },
    results: [],
    aggregates: [
      {
        cellId: "default",
        stageId: "run",
        metric: "durationMs",
        unit: "ms",
        stats: {
          count: 1,
          min: 10,
          max: 10,
          mean: 10,
          median: 10,
          p95: 10,
          stdev: 0,
        },
      },
      {
        cellId: "default",
        stageId: "run",
        metric: "rssBytes",
        unit: "bytes",
        stats: {
          count: 1,
          min: 1,
          max: 1,
          mean: 1,
          median: 1,
          p95: 1,
          stdev: 0,
        },
      },
    ],
    warnings: [],
    ...overrides,
  };
}

describe("buildLeaderboard", () => {
  it("filters medians, sorts by runId, and includes disclaimer", () => {
    const doc = buildLeaderboard(
      [
        { artifact: sampleArtifact({ runId: "run-b" }), sourcePath: "b/run.json" },
        {
          artifact: sampleArtifact({
            runId: "run-a",
            profile: { id: "native-smoke", digest: "abc", path: "p" },
          }),
          sourcePath: "a/run.json",
        },
      ],
      { suiteVersion: "1.0.0", createdAt: "2026-07-11T12:00:00.000Z", metricFilter: "durationMs" },
    );
    assert.equal(doc.kind, "jsbench-leaderboard");
    assert.equal(doc.disclaimer, LEADERBOARD_DISCLAIMER);
    assert.equal(doc.entries.length, 2);
    assert.equal(doc.entries[0]?.runId, "run-a");
    assert.equal(doc.entries[1]?.runId, "run-b");
    assert.equal(doc.entries[0]?.medians.length, 1);
    assert.equal(doc.entries[0]?.medians[0]?.metric, "durationMs");
    assert.match(renderLeaderboardMarkdown(doc), /Not a ranking/);
    assert.doesNotMatch(renderLeaderboardMarkdown(doc), /winner/i);
  });
});
