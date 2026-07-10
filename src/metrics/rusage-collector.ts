import type { Collector, MetricSample, StageContext } from "./types.js";

/**
 * Best-effort process resource collector (orchestrator process deltas).
 * Emits `cpuUserMs`, `cpuSystemMs`, `maxRssBytes`. Skips gracefully if unavailable.
 * @see docs/07_METRICS_ENGINE.md §5.2
 */
export class RusageCollector implements Collector {
  readonly id = "rusage";
  private cpuStart: NodeJS.ResourceUsage | undefined;
  private rssAtStart = 0;

  start(_ctx: StageContext): void {
    try {
      this.cpuStart = process.resourceUsage();
      this.rssAtStart = process.memoryUsage().rss;
    } catch {
      this.cpuStart = undefined;
      this.rssAtStart = 0;
    }
  }

  stop(_ctx: StageContext): readonly MetricSample[] {
    if (this.cpuStart === undefined) {
      return [];
    }
    try {
      const cpuEnd = process.resourceUsage();
      const rssEnd = process.memoryUsage().rss;
      const start = this.cpuStart;
      this.cpuStart = undefined;
      const tags = { accuracy: "best-effort", scope: "orchestrator" };
      return [
        {
          name: "cpuUserMs",
          value: (cpuEnd.userCPUTime - start.userCPUTime) / 1000,
          unit: "ms",
          tags,
        },
        {
          name: "cpuSystemMs",
          value: (cpuEnd.systemCPUTime - start.systemCPUTime) / 1000,
          unit: "ms",
          tags,
        },
        {
          name: "maxRssBytes",
          value: Math.max(this.rssAtStart, rssEnd),
          unit: "bytes",
          tags,
        },
      ];
    } catch {
      this.cpuStart = undefined;
      return [];
    }
  }
}

export function createRusageCollector(): Collector {
  return new RusageCollector();
}
