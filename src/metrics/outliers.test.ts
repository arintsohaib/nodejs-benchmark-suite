import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyOutlierRule } from "./outliers.js";

describe("applyOutlierRule", () => {
  it("is a no-op for rule none", () => {
    const result = applyOutlierRule(
      [
        { cellId: "c", stageId: "s", metric: "durationMs", unit: "ms", value: 1, iteration: 1 },
        { cellId: "c", stageId: "s", metric: "durationMs", unit: "ms", value: 1000, iteration: 2 },
      ],
      "none",
    );
    assert.equal(result.rule, "none");
    assert.equal(result.kept.length, 2);
    assert.equal(result.dropped.length, 0);
  });

  it("skips IQR when a group has fewer than 4 samples", () => {
    const result = applyOutlierRule(
      [
        { cellId: "c", stageId: "s", metric: "durationMs", unit: "ms", value: 10, iteration: 1 },
        { cellId: "c", stageId: "s", metric: "durationMs", unit: "ms", value: 12, iteration: 2 },
        { cellId: "c", stageId: "s", metric: "durationMs", unit: "ms", value: 1000, iteration: 3 },
      ],
      "iqr",
    );
    assert.equal(result.kept.length, 3);
    assert.equal(result.dropped.length, 0);
    assert.ok(result.notes.some((n) => /skipped/i.test(n)));
  });

  it("drops clear Tukey outliers and records iteration + fences", () => {
    const values = [10, 11, 12, 13, 1000];
    const samples = values.map((value, i) => ({
      cellId: "default",
      stageId: "build",
      metric: "durationMs" as const,
      unit: "ms" as const,
      value,
      iteration: i + 1,
    }));
    const result = applyOutlierRule(samples, "iqr");
    assert.equal(result.dropped.length, 1);
    assert.equal(result.dropped[0]?.value, 1000);
    assert.equal(result.dropped[0]?.iteration, 5);
    assert.equal(result.dropped[0]?.reason, "above-fence");
    assert.equal(result.kept.length, 4);
    assert.ok(result.notes.some((n) => /dropped 1 of 5/i.test(n)));
  });

  it("never empties a group without restoring samples", () => {
    const result = applyOutlierRule(
      [1, 2, 3, 4].map((value, i) => ({
        cellId: "c",
        stageId: "s",
        metric: "durationMs" as const,
        unit: "ms" as const,
        value,
        iteration: i + 1,
      })),
      "iqr",
    );
    assert.ok(result.kept.length >= 1);
    assert.equal(result.kept.length + result.dropped.length, 4);
  });
});
