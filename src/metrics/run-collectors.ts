import type { Collector, MetricSample, MetricUnit, StageContext } from "./types.js";

const KNOWN_UNITS: Readonly<Record<string, MetricUnit>> = {
  durationMs: "ms",
  cpuUserMs: "ms",
  cpuSystemMs: "ms",
  maxRssBytes: "bytes",
  workspaceBytesBefore: "bytes",
  workspaceBytesAfter: "bytes",
  workspaceBytesDelta: "bytes",
  containerCpuPercentAvg: "percent",
  containerCpuPercentMax: "percent",
  containerMemBytesAvg: "bytes",
  containerMemMaxBytes: "bytes",
};

/** Infer aggregate unit from a metric name (v1 known set). */
export function unitForMetric(name: string): MetricUnit {
  return KNOWN_UNITS[name] ?? "count";
}

export function samplesToMetricsRecord(samples: readonly MetricSample[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sample of samples) {
    out[sample.name] = sample.value;
  }
  return out;
}

/**
 * Run optional collectors around a stage body (excludes built-in `wall`,
 * which is provided by the process/docker timer).
 */
export async function runWithOptionalCollectors<T>(options: {
  readonly collectors: readonly Collector[];
  readonly ctx: StageContext;
  readonly run: () => Promise<T>;
}): Promise<{ readonly result: T; readonly samples: readonly MetricSample[] }> {
  const active = options.collectors.filter((c) => c.id !== "wall");
  for (const collector of active) {
    await Promise.resolve(collector.start(options.ctx));
  }

  let result: T;
  try {
    result = await options.run();
  } catch (error) {
    for (const collector of active) {
      try {
        await Promise.resolve(collector.stop(options.ctx));
      } catch {
        // ignore stop errors after failure
      }
    }
    throw error;
  }

  const samples: MetricSample[] = [];
  for (const collector of active) {
    try {
      const part = await Promise.resolve(collector.stop(options.ctx));
      samples.push(...part);
    } catch {
      // best-effort: skip collector failures
    }
  }

  return { result, samples };
}
