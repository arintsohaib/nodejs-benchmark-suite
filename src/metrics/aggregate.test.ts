import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createMetricsAggregator } from "./aggregate.js";
import { computeAggregateStats, nearestRankPercentile } from "./stats.js";
import type { StageContext } from "./types.js";
import { WALL_TIMING_SOURCE, createWallCollector } from "./wall-collector.js";

const ctx: StageContext = {
  runId: "run-1",
  cellId: "default",
  stageId: "build",
  iteration: 1,
  iterationKind: "measured",
  workspacePath: "/tmp",
};

describe("nearestRankPercentile", () => {
  it("uses nearest-rank for p95 on a known series", () => {
    // n=20 → rank = ceil(0.95*20) = 19 → 0-based index 18 → value 19
    const sorted = Array.from({ length: 20 }, (_, i) => i + 1);
    assert.equal(nearestRankPercentile(sorted, 0.95), 19);
  });
});

describe("computeAggregateStats", () => {
  it("matches golden fixture for a fixed sample set", () => {
    const values = [10, 20, 30, 40, 50];
    const stats = computeAggregateStats(values);
    assert.deepEqual(stats, {
      count: 5,
      min: 10,
      max: 50,
      mean: 30,
      median: 30,
      p95: 50, // nearest-rank: ceil(0.95*5)=5 → index 4 → 50
      stdev: Math.sqrt(250), // sample variance of [10..50] around 30
    });
  });
});

describe("DefaultMetricsAggregator", () => {
  it("groups by cell/stage/metric and sorts stably", () => {
    const aggregator = createMetricsAggregator();
    const aggregates = aggregator.aggregate([
      { cellId: "b", stageId: "build", metric: "durationMs", unit: "ms", value: 2 },
      { cellId: "a", stageId: "build", metric: "durationMs", unit: "ms", value: 4 },
      { cellId: "a", stageId: "build", metric: "durationMs", unit: "ms", value: 6 },
    ]);

    assert.equal(aggregates.length, 2);
    assert.equal(aggregates[0]?.cellId, "a");
    assert.equal(aggregates[0]?.stats.count, 2);
    assert.equal(aggregates[0]?.stats.mean, 5);
    assert.equal(aggregates[1]?.cellId, "b");
    assert.equal(aggregates[1]?.stats.count, 1);
  });
});

describe("WallCollector", () => {
  it("emits non-negative durationMs with hrtime source tag", async () => {
    const collector = createWallCollector();
    collector.start(ctx);
    await delay(20);
    const samples = await Promise.resolve(collector.stop(ctx));
    assert.equal(samples.length, 1);
    const sample = samples[0];
    assert.ok(sample);
    assert.equal(sample.name, "durationMs");
    assert.equal(sample.unit, "ms");
    assert.ok(sample.value >= 15);
    assert.equal(sample.tags?.["timingSource"], WALL_TIMING_SOURCE);
  });

  it("is safe if stop is called without start", async () => {
    const collector = createWallCollector();
    const samples = await Promise.resolve(collector.stop(ctx));
    assert.equal(samples.length, 1);
    assert.ok((samples[0]?.value ?? -1) >= 0);
  });
});
