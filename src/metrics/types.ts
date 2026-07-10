/**
 * Metrics abstractions and implementations (wall, rusage, disk-usage + aggregations).
 * @see docs/07_METRICS_ENGINE.md
 * @see docs/17_IMPLEMENTATION_PLAN.md S5, S15
 */

export type MetricUnit = "ms" | "bytes" | "count" | "percent" | "ratio";

export interface MetricSample {
  readonly name: string;
  readonly value: number;
  readonly unit: MetricUnit;
  readonly tags?: Readonly<Record<string, string>>;
}

/** Context passed to collectors around a single stage iteration. */
export interface StageContext {
  readonly runId: string;
  readonly cellId: string;
  readonly stageId: string;
  readonly iteration: number;
  readonly iterationKind: "warmup" | "measured";
  readonly workspacePath: string;
}

export interface Collector {
  readonly id: string;
  start(ctx: StageContext): Promise<void> | void;
  stop(ctx: StageContext): Promise<readonly MetricSample[]> | readonly MetricSample[];
}

export interface AggregateStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly p95: number;
  readonly stdev: number;
}

export interface MetricAggregate {
  readonly cellId: string;
  readonly stageId: string;
  readonly metric: string;
  readonly unit: MetricUnit;
  readonly stats: AggregateStats;
}

/**
 * Pure aggregation over measured samples.
 * @see createMetricsAggregator in ./aggregate.ts
 */
export interface MetricsAggregator {
  aggregate(
    samples: ReadonlyArray<{
      readonly cellId: string;
      readonly stageId: string;
      readonly metric: string;
      readonly unit: MetricUnit;
      readonly value: number;
    }>,
  ): readonly MetricAggregate[];
}
