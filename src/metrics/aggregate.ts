import { type AggregateInputSample, computeAggregateStats, groupKey } from "./stats.js";
import type { MetricAggregate, MetricUnit, MetricsAggregator } from "./types.js";

type GroupState = {
  readonly cellId: string;
  readonly stageId: string;
  readonly metric: string;
  readonly unit: MetricUnit;
  readonly values: number[];
};

/**
 * Pure aggregator over measured samples keyed by (cellId, stageId, metric, unit).
 */
export class DefaultMetricsAggregator implements MetricsAggregator {
  aggregate(samples: ReadonlyArray<AggregateInputSample>): readonly MetricAggregate[] {
    const groups = new Map<string, GroupState>();

    for (const sample of samples) {
      if (!Number.isFinite(sample.value)) {
        continue;
      }
      const key = groupKey(sample);
      const existing = groups.get(key);
      if (existing === undefined) {
        groups.set(key, {
          cellId: sample.cellId,
          stageId: sample.stageId,
          metric: sample.metric,
          unit: sample.unit,
          values: [sample.value],
        });
      } else {
        existing.values.push(sample.value);
      }
    }

    const aggregates: MetricAggregate[] = [];
    for (const group of groups.values()) {
      aggregates.push({
        cellId: group.cellId,
        stageId: group.stageId,
        metric: group.metric,
        unit: group.unit,
        stats: computeAggregateStats(group.values),
      });
    }

    aggregates.sort((a, b) => {
      const left = `${a.cellId}|${a.stageId}|${a.metric}|${a.unit}`;
      const right = `${b.cellId}|${b.stageId}|${b.metric}|${b.unit}`;
      return left.localeCompare(right);
    });

    return aggregates;
  }
}

export function createMetricsAggregator(): MetricsAggregator {
  return new DefaultMetricsAggregator();
}
