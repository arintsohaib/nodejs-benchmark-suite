import type { DiffRow, ReportDiffResult } from "./diff.js";

export type RegressionGateOptions = {
  /** Fail when percent increase (right vs left) exceeds this value (e.g. 10 = 10%). */
  readonly maxPercentIncrease?: number;
  /** Fail when absolute increase (right − left) exceeds this value (same units as the metric). */
  readonly maxAbsoluteIncrease?: number;
  /** Only evaluate rows for this metric (default: all metrics in the diff). */
  readonly metric?: string;
  /** Treat left-only / right-only rows as gate failures (default: true). */
  readonly failOnMissing?: boolean;
  /** Fail when left and right profile digests differ (default: false). */
  readonly requireSameProfileDigest?: boolean;
};

export type RegressionViolation =
  | {
      readonly kind: "percent";
      readonly stageId: string;
      readonly metric: string;
      readonly cellKey: string;
      readonly leftMedian: number;
      readonly rightMedian: number;
      readonly deltaPercent: number;
      readonly limit: number;
    }
  | {
      readonly kind: "absolute";
      readonly stageId: string;
      readonly metric: string;
      readonly cellKey: string;
      readonly leftMedian: number;
      readonly rightMedian: number;
      readonly deltaAbsolute: number;
      readonly limit: number;
    }
  | {
      readonly kind: "missing";
      readonly stageId: string;
      readonly metric: string;
      readonly cellKey: string;
      readonly presence: "left-only" | "right-only";
    }
  | {
      readonly kind: "profile-digest-mismatch";
      readonly leftProfileDigest: string;
      readonly rightProfileDigest: string;
    };

export type RegressionGateResult = {
  readonly ok: boolean;
  readonly violations: readonly RegressionViolation[];
};

function rowMatchesMetric(row: DiffRow, metric: string | undefined): boolean {
  return metric === undefined || row.metric === metric;
}

/**
 * Evaluate a report diff against optional regression thresholds.
 * Increases (right > left) beyond limits are treated as regressions for duration-like metrics.
 * At least one of `maxPercentIncrease` or `maxAbsoluteIncrease` must be set.
 */
export function evaluateRegressionGate(
  diff: ReportDiffResult,
  options: RegressionGateOptions,
): RegressionGateResult {
  const hasPercent = options.maxPercentIncrease !== undefined;
  const hasAbsolute = options.maxAbsoluteIncrease !== undefined;
  if (!hasPercent && !hasAbsolute) {
    throw new Error(
      "evaluateRegressionGate requires maxPercentIncrease and/or maxAbsoluteIncrease",
    );
  }

  const failOnMissing = options.failOnMissing !== false;
  const violations: RegressionViolation[] = [];

  if (
    options.requireSameProfileDigest === true &&
    diff.leftProfileDigest !== diff.rightProfileDigest
  ) {
    violations.push({
      kind: "profile-digest-mismatch",
      leftProfileDigest: diff.leftProfileDigest,
      rightProfileDigest: diff.rightProfileDigest,
    });
  }

  for (const row of diff.rows) {
    if (!rowMatchesMetric(row, options.metric)) {
      continue;
    }
    if (row.presence !== "both") {
      if (failOnMissing) {
        violations.push({
          kind: "missing",
          stageId: row.stageId,
          metric: row.metric,
          cellKey: row.cellKey,
          presence: row.presence,
        });
      }
      continue;
    }

    const left = row.leftMedian;
    const right = row.rightMedian;
    const deltaAbsolute = row.deltaAbsolute;
    if (left === undefined || right === undefined || deltaAbsolute === undefined) {
      continue;
    }

    if (hasAbsolute && deltaAbsolute > (options.maxAbsoluteIncrease as number)) {
      violations.push({
        kind: "absolute",
        stageId: row.stageId,
        metric: row.metric,
        cellKey: row.cellKey,
        leftMedian: left,
        rightMedian: right,
        deltaAbsolute,
        limit: options.maxAbsoluteIncrease as number,
      });
    }

    if (hasPercent && row.deltaPercent !== undefined) {
      if (row.deltaPercent > (options.maxPercentIncrease as number)) {
        violations.push({
          kind: "percent",
          stageId: row.stageId,
          metric: row.metric,
          cellKey: row.cellKey,
          leftMedian: left,
          rightMedian: right,
          deltaPercent: row.deltaPercent,
          limit: options.maxPercentIncrease as number,
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}
