import type { Collector, MetricSample, StageContext } from "./types.js";

/** Timing source recorded for wall-clock samples. */
export const WALL_TIMING_SOURCE = "node-hrtime" as const;

/**
 * Wall-clock collector using `process.hrtime.bigint()` (monotonic).
 * Emits `durationMs`. Safe if `stop` is called after failure.
 */
export class WallCollector implements Collector {
  readonly id = "wall";
  private startedAtNs: bigint | undefined;

  start(_ctx: StageContext): void {
    this.startedAtNs = process.hrtime.bigint();
  }

  stop(_ctx: StageContext): readonly MetricSample[] {
    const endedAtNs = process.hrtime.bigint();
    const startedAtNs = this.startedAtNs ?? endedAtNs;
    this.startedAtNs = undefined;
    const durationMs = Number(endedAtNs - startedAtNs) / 1_000_000;
    return [
      {
        name: "durationMs",
        value: durationMs,
        unit: "ms",
        tags: { timingSource: WALL_TIMING_SOURCE },
      },
    ];
  }
}

export function createWallCollector(): Collector {
  return new WallCollector();
}
