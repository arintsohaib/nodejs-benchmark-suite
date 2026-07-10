import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReportDiffResult } from "./diff.js";
import { evaluateRegressionGate } from "./regression-gate.js";

function sampleDiff(overrides: Partial<ReportDiffResult> = {}): ReportDiffResult {
  return {
    leftRunId: "left",
    rightRunId: "right",
    leftProfileDigest: "aaa",
    rightProfileDigest: "aaa",
    rows: [
      {
        stageId: "install",
        metric: "durationMs",
        cellKey: "default",
        leftMedian: 100,
        rightMedian: 120,
        deltaAbsolute: 20,
        deltaPercent: 20,
        presence: "both",
      },
    ],
    ...overrides,
  };
}

describe("evaluateRegressionGate", () => {
  it("passes when increases stay within percent and absolute limits", () => {
    const result = evaluateRegressionGate(sampleDiff(), {
      maxPercentIncrease: 25,
      maxAbsoluteIncrease: 50,
      metric: "durationMs",
    });
    assert.equal(result.ok, true);
    assert.equal(result.violations.length, 0);
  });

  it("fails on percent increase beyond the limit", () => {
    const result = evaluateRegressionGate(sampleDiff(), {
      maxPercentIncrease: 10,
      metric: "durationMs",
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.kind, "percent");
  });

  it("fails on absolute increase beyond the limit", () => {
    const result = evaluateRegressionGate(sampleDiff(), {
      maxAbsoluteIncrease: 5,
      metric: "durationMs",
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.kind, "absolute");
  });

  it("treats missing cells as violations by default", () => {
    const result = evaluateRegressionGate(
      sampleDiff({
        rows: [
          {
            stageId: "build",
            metric: "durationMs",
            cellKey: "default",
            leftMedian: 50,
            presence: "left-only",
          },
        ],
      }),
      { maxPercentIncrease: 10, metric: "durationMs" },
    );
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.kind, "missing");
  });

  it("can require matching profile digests", () => {
    const result = evaluateRegressionGate(sampleDiff({ rightProfileDigest: "bbb" }), {
      maxPercentIncrease: 100,
      requireSameProfileDigest: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.kind, "profile-digest-mismatch");
  });

  it("throws when no threshold is configured", () => {
    assert.throws(() => evaluateRegressionGate(sampleDiff(), {}), /maxPercentIncrease/);
  });
});
