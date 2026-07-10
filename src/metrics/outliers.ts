import { type AggregateInputSample, groupKey, nearestRankPercentile } from "./stats.js";
import type { MetricUnit } from "./types.js";

/** Tukey IQR fence multiplier (locked for S21). */
export const IQR_FENCE_MULTIPLIER = 1.5;

/** Minimum samples per group before IQR filtering is applied. */
export const IQR_MIN_SAMPLES = 4;

export type OutlierRule = "none" | "iqr";

export type AggregateSampleWithIteration = AggregateInputSample & {
  readonly iteration?: number;
};

export type OutlierDrop = {
  readonly cellId: string;
  readonly stageId: string;
  readonly metric: string;
  readonly unit: MetricUnit;
  readonly iteration?: number;
  readonly value: number;
  readonly fenceLow: number;
  readonly fenceHigh: number;
  readonly reason: "below-fence" | "above-fence";
};

export type OutlierFilterResult = {
  readonly rule: OutlierRule;
  readonly kept: readonly AggregateInputSample[];
  readonly dropped: readonly OutlierDrop[];
  /** Human-readable notes (also suitable for run warnings). */
  readonly notes: readonly string[];
};

type GroupSample = {
  readonly value: number;
  readonly iteration?: number;
};

/**
 * Apply an explicit outlier rule before aggregation.
 * Default / `none`: identity. `iqr`: Tukey fences with nearest-rank Q1/Q3.
 * Groups with fewer than {@link IQR_MIN_SAMPLES} samples are left unchanged (noted).
 */
export function applyOutlierRule(
  samples: ReadonlyArray<AggregateSampleWithIteration>,
  rule: OutlierRule = "none",
): OutlierFilterResult {
  if (rule === "none") {
    return {
      rule: "none",
      kept: samples.map(({ cellId, stageId, metric, unit, value }) => ({
        cellId,
        stageId,
        metric,
        unit,
        value,
      })),
      dropped: [],
      notes: [],
    };
  }

  const groups = new Map<
    string,
    {
      cellId: string;
      stageId: string;
      metric: string;
      unit: MetricUnit;
      items: GroupSample[];
    }
  >();

  for (const sample of samples) {
    if (!Number.isFinite(sample.value)) {
      continue;
    }
    const key = groupKey(sample);
    const existing = groups.get(key);
    const item: GroupSample = {
      value: sample.value,
      ...(sample.iteration !== undefined ? { iteration: sample.iteration } : {}),
    };
    if (existing === undefined) {
      groups.set(key, {
        cellId: sample.cellId,
        stageId: sample.stageId,
        metric: sample.metric,
        unit: sample.unit,
        items: [item],
      });
    } else {
      existing.items.push(item);
    }
  }

  const kept: AggregateInputSample[] = [];
  const dropped: OutlierDrop[] = [];
  const notes: string[] = [];

  for (const group of groups.values()) {
    const label = `${group.cellId}/${group.stageId}/${group.metric}`;
    if (group.items.length < IQR_MIN_SAMPLES) {
      notes.push(
        `IQR outlier rule skipped for ${label}: need ≥${IQR_MIN_SAMPLES} measured samples (have ${group.items.length}).`,
      );
      for (const item of group.items) {
        kept.push({
          cellId: group.cellId,
          stageId: group.stageId,
          metric: group.metric,
          unit: group.unit,
          value: item.value,
        });
      }
      continue;
    }

    const sortedValues = group.items.map((i) => i.value).sort((a, b) => a - b);
    const q1 = nearestRankPercentile(sortedValues, 0.25);
    const q3 = nearestRankPercentile(sortedValues, 0.75);
    const iqr = q3 - q1;
    const fenceLow = q1 - IQR_FENCE_MULTIPLIER * iqr;
    const fenceHigh = q3 + IQR_FENCE_MULTIPLIER * iqr;

    let keptInGroup = 0;
    for (const item of group.items) {
      if (item.value < fenceLow || item.value > fenceHigh) {
        dropped.push({
          cellId: group.cellId,
          stageId: group.stageId,
          metric: group.metric,
          unit: group.unit,
          ...(item.iteration !== undefined ? { iteration: item.iteration } : {}),
          value: item.value,
          fenceLow,
          fenceHigh,
          reason: item.value < fenceLow ? "below-fence" : "above-fence",
        });
      } else {
        kept.push({
          cellId: group.cellId,
          stageId: group.stageId,
          metric: group.metric,
          unit: group.unit,
          value: item.value,
        });
        keptInGroup += 1;
      }
    }

    if (keptInGroup === 0) {
      // Never empty a group silently — restore all and note.
      notes.push(
        `IQR outlier rule would drop all samples for ${label}; keeping all ${group.items.length} values.`,
      );
      for (const item of group.items) {
        kept.push({
          cellId: group.cellId,
          stageId: group.stageId,
          metric: group.metric,
          unit: group.unit,
          value: item.value,
        });
      }
      // Remove drops we just recorded for this group
      for (let i = dropped.length - 1; i >= 0; i -= 1) {
        const d = dropped[i];
        if (
          d !== undefined &&
          d.cellId === group.cellId &&
          d.stageId === group.stageId &&
          d.metric === group.metric
        ) {
          dropped.splice(i, 1);
        }
      }
    } else if (group.items.length - keptInGroup > 0) {
      notes.push(
        `IQR outlier rule dropped ${group.items.length - keptInGroup} of ${group.items.length} samples for ${label} (fences [${fenceLow}, ${fenceHigh}]).`,
      );
    }
  }

  return { rule: "iqr", kept, dropped, notes };
}
