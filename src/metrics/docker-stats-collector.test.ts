import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DockerStatsCollector,
  MIN_DOCKER_STATS_INTERVAL_MS,
  createDockerStatsCollector,
  parseDockerStatsCpuPercent,
  parseDockerStatsJsonLine,
  parseDockerStatsMemUsageBytes,
} from "./docker-stats-collector.js";
import { runWithOptionalCollectors } from "./run-collectors.js";
import type { StageContext } from "./types.js";

const BASE_CTX: StageContext = {
  runId: "t",
  cellId: "c",
  stageId: "s",
  iteration: 1,
  iterationKind: "measured",
  workspacePath: ".",
};

describe("docker-stats parsers", () => {
  it("parses CPU percent and memory usage", () => {
    assert.equal(parseDockerStatsCpuPercent("12.34%"), 12.34);
    assert.equal(parseDockerStatsMemUsageBytes("100MiB / 2GiB"), 100 * 1024 * 1024);
    assert.equal(parseDockerStatsMemUsageBytes("1.5GiB / 8GiB"), 1.5 * 1024 ** 3);
    const point = parseDockerStatsJsonLine(
      '{"CPUPerc":"5.00%","MemUsage":"64MiB / 1GiB","Name":"c1"}',
    );
    assert.deepEqual(point, { cpuPercent: 5, memBytes: 64 * 1024 * 1024 });
  });

  it("returns undefined for malformed input", () => {
    assert.equal(parseDockerStatsCpuPercent("nope"), undefined);
    assert.equal(parseDockerStatsMemUsageBytes("bad"), undefined);
    assert.equal(parseDockerStatsJsonLine("{"), undefined);
  });
});

describe("docker-stats collector", () => {
  it("skips when StageContext has no docker container", async () => {
    const collector = createDockerStatsCollector({
      sample: async () => {
        throw new Error("should not sample");
      },
    });
    collector.start(BASE_CTX);
    const samples = await collector.stop(BASE_CTX);
    assert.deepEqual(samples, []);
  });

  it("emits avg/max CPU and memory from injected samples", async () => {
    const points = [
      { cpuPercent: 10, memBytes: 100 },
      { cpuPercent: 30, memBytes: 300 },
    ];
    let i = 0;
    const collector = createDockerStatsCollector({
      intervalMs: MIN_DOCKER_STATS_INTERVAL_MS,
      sample: async () => points[Math.min(i++, points.length - 1)],
    });
    const ctx: StageContext = {
      ...BASE_CTX,
      docker: { containerName: "jsbench-test" },
    };
    const { samples } = await runWithOptionalCollectors({
      collectors: [collector],
      ctx,
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 450));
        return true;
      },
    });
    const byName = Object.fromEntries(samples.map((s) => [s.name, s]));
    assert.ok(byName["containerCpuPercentAvg"]);
    assert.ok(byName["containerCpuPercentMax"]);
    assert.ok(byName["containerMemBytesAvg"]);
    assert.ok(byName["containerMemMaxBytes"]);
    assert.equal(byName["containerCpuPercentMax"]?.value, 30);
    assert.equal(byName["containerMemMaxBytes"]?.value, 300);
    assert.equal(byName["containerCpuPercentAvg"]?.unit, "percent");
    assert.equal(byName["containerMemMaxBytes"]?.unit, "bytes");
    assert.equal(byName["containerCpuPercentAvg"]?.tags?.["scope"], "container");
  });

  it("clamps interval below 200ms", () => {
    const collector = createDockerStatsCollector({ intervalMs: 50 });
    assert.ok(collector instanceof DockerStatsCollector);
    assert.equal(collector.intervalMs, MIN_DOCKER_STATS_INTERVAL_MS);
  });
});
