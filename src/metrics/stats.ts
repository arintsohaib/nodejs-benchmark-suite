import type { AggregateStats, MetricUnit } from "./types.js";

function requireIndex(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Missing value at index ${index}`);
  }
  return value;
}

/**
 * Nearest-rank percentile (1-based rank = ceil(p * n)).
 * Locked for v1 — do not switch to linear interpolation without a schema/docs bump.
 * @see docs/07_METRICS_ENGINE.md
 */
export function nearestRankPercentile(sortedAscending: readonly number[], p: number): number {
  if (sortedAscending.length === 0) {
    throw new Error("nearestRankPercentile requires at least one sample");
  }
  if (p <= 0) {
    return requireIndex(sortedAscending, 0);
  }
  if (p >= 1) {
    return requireIndex(sortedAscending, sortedAscending.length - 1);
  }
  const rank = Math.ceil(p * sortedAscending.length);
  const index = Math.min(sortedAscending.length, Math.max(1, rank)) - 1;
  return requireIndex(sortedAscending, index);
}

function medianSorted(sortedAscending: readonly number[]): number {
  const n = sortedAscending.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return requireIndex(sortedAscending, mid);
  }
  return (requireIndex(sortedAscending, mid - 1) + requireIndex(sortedAscending, mid)) / 2;
}

function sampleStdev(values: readonly number[], mean: number): number {
  if (values.length < 2) {
    return 0;
  }
  let sumSq = 0;
  for (const value of values) {
    const d = value - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

/** Compute aggregate stats for a non-empty set of numeric samples. */
export function computeAggregateStats(values: readonly number[]): AggregateStats {
  if (values.length === 0) {
    throw new Error("computeAggregateStats requires at least one sample");
  }

  const sorted = [...values].sort((a, b) => a - b);
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  const mean = sum / values.length;

  return {
    count: values.length,
    min: requireIndex(sorted, 0),
    max: requireIndex(sorted, sorted.length - 1),
    mean,
    median: medianSorted(sorted),
    p95: nearestRankPercentile(sorted, 0.95),
    stdev: sampleStdev(values, mean),
  };
}

export type AggregateInputSample = {
  readonly cellId: string;
  readonly stageId: string;
  readonly metric: string;
  readonly unit: MetricUnit;
  readonly value: number;
};

export function groupKey(sample: AggregateInputSample): string {
  return `${sample.cellId}\0${sample.stageId}\0${sample.metric}\0${sample.unit}`;
}
