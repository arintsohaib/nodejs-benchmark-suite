import { BenchError } from "../errors/bench-error.js";
import { createDiskUsageCollector } from "../metrics/disk-usage-collector.js";
import { createRusageCollector } from "../metrics/rusage-collector.js";
import type { Collector } from "../metrics/types.js";
import { createWallCollector } from "../metrics/wall-collector.js";
import type { Reporter } from "../reporting/types.js";
import { loadPluginModule } from "./load-plugin.js";
import type { JsBenchPlugin } from "./types.js";

export type CollectorFactory = () => Collector;
export type ReporterFactory = () => Reporter;

export type PluginRegistry = {
  readonly plugins: readonly JsBenchPlugin[];
  createCollector(id: string): Collector;
  createCollectors(ids: readonly string[]): Collector[];
  listCollectorIds(): readonly string[];
  createReporter(id: string): Reporter;
  createReporters(ids: readonly string[]): Reporter[];
  listReporterIds(): readonly string[];
};

function toCollectorFactory(entry: Collector | (() => Collector)): CollectorFactory {
  return typeof entry === "function" ? entry : () => entry;
}

function toReporterFactory(entry: Reporter | (() => Reporter)): ReporterFactory {
  return typeof entry === "function" ? entry : () => entry;
}

/**
 * Build a registry of built-in + plugin collectors/reporters.
 * Built-ins: `wall`, `rusage`, `disk-usage`.
 */
export async function createPluginRegistry(options: {
  readonly pluginPaths?: readonly string[];
}): Promise<PluginRegistry> {
  const collectors = new Map<string, CollectorFactory>([
    ["wall", createWallCollector],
    ["rusage", createRusageCollector],
    ["disk-usage", createDiskUsageCollector],
  ]);
  const reporters = new Map<string, ReporterFactory>();
  const loaded: JsBenchPlugin[] = [];

  for (const path of options.pluginPaths ?? []) {
    const plugin = await loadPluginModule(path);
    loaded.push(plugin);
    for (const entry of plugin.collectors ?? []) {
      const factory = toCollectorFactory(entry);
      const probe = factory();
      if (collectors.has(probe.id)) {
        throw new BenchError(
          "INVALID_CONFIG",
          `Plugin collector id "${probe.id}" conflicts with an existing collector`,
          { pluginId: plugin.id, collectorId: probe.id, path },
        );
      }
      collectors.set(probe.id, factory);
    }
    for (const entry of plugin.reporters ?? []) {
      const factory = toReporterFactory(entry);
      const probe = factory();
      if (reporters.has(probe.id)) {
        throw new BenchError(
          "INVALID_CONFIG",
          `Plugin reporter id "${probe.id}" conflicts with an existing reporter`,
          { pluginId: plugin.id, reporterId: probe.id, path },
        );
      }
      reporters.set(probe.id, factory);
    }
  }

  const createCollector = (id: string): Collector => {
    const factory = collectors.get(id);
    if (factory === undefined) {
      throw new BenchError("INVALID_CONFIG", `Unknown collector: ${id}`, {
        collectorId: id,
        known: [...collectors.keys()],
      });
    }
    const collector = factory();
    if (collector.id !== id) {
      throw new BenchError(
        "INVALID_CONFIG",
        `Collector factory for "${id}" produced id "${collector.id}"`,
        { expected: id, actual: collector.id },
      );
    }
    return collector;
  };

  const createReporter = (id: string): Reporter => {
    const factory = reporters.get(id);
    if (factory === undefined) {
      throw new BenchError("INVALID_CONFIG", `Unknown reporter: ${id}`, {
        reporterId: id,
        known: [...reporters.keys()],
      });
    }
    const reporter = factory();
    if (reporter.id !== id) {
      throw new BenchError(
        "INVALID_CONFIG",
        `Reporter factory for "${id}" produced id "${reporter.id}"`,
        { expected: id, actual: reporter.id },
      );
    }
    return reporter;
  };

  return {
    plugins: loaded,
    createCollector,
    createCollectors(ids: readonly string[]): Collector[] {
      return ids.map((id) => createCollector(id));
    },
    listCollectorIds(): readonly string[] {
      return [...collectors.keys()].sort((a, b) => a.localeCompare(b));
    },
    createReporter,
    createReporters(ids: readonly string[]): Reporter[] {
      return ids.map((id) => createReporter(id));
    },
    listReporterIds(): readonly string[] {
      return [...reporters.keys()].sort((a, b) => a.localeCompare(b));
    },
  };
}

/** Default collector ids when a profile omits `metrics.collectors`. */
export const DEFAULT_COLLECTOR_IDS = ["wall"] as const;
