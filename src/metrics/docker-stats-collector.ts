import { createDockerCli } from "../runners/docker/cli.js";
import type { DockerCli } from "../runners/docker/types.js";
import type { Collector, MetricSample, StageContext } from "./types.js";

/** Floor for sampling interval (docs/07_METRICS_ENGINE.md §10). */
export const MIN_DOCKER_STATS_INTERVAL_MS = 200 as const;

export type DockerStatsPoint = {
  readonly cpuPercent: number;
  readonly memBytes: number;
};

export type DockerStatsSampler = (containerName: string) => Promise<DockerStatsPoint | undefined>;

const BYTE_UNITS: Readonly<Record<string, number>> = {
  b: 1,
  k: 1024,
  kb: 1024,
  kib: 1024,
  m: 1024 ** 2,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  g: 1024 ** 3,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
  t: 1024 ** 4,
  tb: 1024 ** 4,
  tib: 1024 ** 4,
};

/** Parse `CPUPerc` fields like `12.34%`. */
export function parseDockerStatsCpuPercent(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/%$/, "");
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/** Parse the used side of `MemUsage` (`100MiB / 2GiB`). */
export function parseDockerStatsMemUsageBytes(memUsage: string): number | undefined {
  const used = memUsage.split("/")[0]?.trim();
  if (used === undefined || used === "") {
    return undefined;
  }
  const match = /^([0-9]*\.?[0-9]+)\s*([A-Za-z]+)$/.exec(used);
  if (match === null) {
    return undefined;
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  if (!Number.isFinite(amount) || unit === undefined) {
    return undefined;
  }
  const factor = BYTE_UNITS[unit];
  if (factor === undefined) {
    return undefined;
  }
  return amount * factor;
}

/** Parse one `docker stats --format '{{json .}}'` line. */
export function parseDockerStatsJsonLine(line: string): DockerStatsPoint | undefined {
  const trimmed = line.trim();
  if (trimmed === "") {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      CPUPerc?: string;
      MemUsage?: string;
    };
    if (parsed.CPUPerc === undefined || parsed.MemUsage === undefined) {
      return undefined;
    }
    const cpuPercent = parseDockerStatsCpuPercent(parsed.CPUPerc);
    const memBytes = parseDockerStatsMemUsageBytes(parsed.MemUsage);
    if (cpuPercent === undefined || memBytes === undefined) {
      return undefined;
    }
    return { cpuPercent, memBytes };
  } catch {
    return undefined;
  }
}

export async function sampleDockerStatsViaCli(
  cli: DockerCli,
  containerName: string,
): Promise<DockerStatsPoint | undefined> {
  try {
    const result = await cli.exec(
      ["stats", "--no-stream", "--format", "{{json .}}", containerName],
      { timeoutMs: 15_000 },
    );
    if (result.exitCode !== 0) {
      return undefined;
    }
    const line = result.stdout.split("\n").find((entry) => entry.trim() !== "");
    return line !== undefined ? parseDockerStatsJsonLine(line) : undefined;
  } catch {
    return undefined;
  }
}

export type DockerStatsCollectorOptions = {
  /** Sampling interval in ms (clamped to ≥ 200). */
  readonly intervalMs?: number;
  /** Injected sampler for tests; default uses `docker stats` via Docker CLI. */
  readonly sample?: DockerStatsSampler;
};

/**
 * Best-effort container CPU/memory sampler via `docker stats`.
 * Skips on native runs (no `ctx.docker`) or when sampling fails.
 * @see docs/07_METRICS_ENGINE.md §5.4
 */
export class DockerStatsCollector implements Collector {
  readonly id = "docker-stats";
  /** Effective sampling interval after applying the ≥200ms floor. */
  readonly intervalMs: number;
  private readonly sample: DockerStatsSampler;
  private timer: NodeJS.Timeout | undefined;
  private sampling = false;
  private readonly points: DockerStatsPoint[] = [];
  private armed = false;

  constructor(options: DockerStatsCollectorOptions = {}) {
    this.intervalMs = Math.max(
      MIN_DOCKER_STATS_INTERVAL_MS,
      options.intervalMs ?? MIN_DOCKER_STATS_INTERVAL_MS,
    );
    this.sample =
      options.sample ??
      ((containerName: string) => sampleDockerStatsViaCli(createDockerCli(), containerName));
  }

  start(ctx: StageContext): void {
    this.points.length = 0;
    this.armed = false;
    const containerName = ctx.docker?.containerName;
    if (containerName === undefined || containerName === "") {
      return;
    }
    this.armed = true;
    const tick = (): void => {
      if (!this.armed || this.sampling) {
        return;
      }
      this.sampling = true;
      void this.sample(containerName)
        .then((point) => {
          if (point !== undefined && this.armed) {
            this.points.push(point);
          }
        })
        .catch(() => {
          // best-effort
        })
        .finally(() => {
          this.sampling = false;
        });
    };
    tick();
    this.timer = setInterval(tick, this.intervalMs);
    // Allow the process to exit if only this timer remains (tests / short stages).
    this.timer.unref?.();
  }

  async stop(_ctx: StageContext): Promise<readonly MetricSample[]> {
    this.armed = false;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    // Wait briefly for an in-flight sample to finish.
    const deadline = Date.now() + 50;
    while (this.sampling && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    this.sampling = false;
    if (this.points.length === 0) {
      return [];
    }
    const cpu = this.points.map((p) => p.cpuPercent);
    const mem = this.points.map((p) => p.memBytes);
    const tags = { accuracy: "best-effort", scope: "container" };
    return [
      {
        name: "containerCpuPercentAvg",
        value: mean(cpu),
        unit: "percent",
        tags,
      },
      {
        name: "containerCpuPercentMax",
        value: Math.max(...cpu),
        unit: "percent",
        tags,
      },
      {
        name: "containerMemBytesAvg",
        value: mean(mem),
        unit: "bytes",
        tags,
      },
      {
        name: "containerMemMaxBytes",
        value: Math.max(...mem),
        unit: "bytes",
        tags,
      },
    ];
  }
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function createDockerStatsCollector(options?: DockerStatsCollectorOptions): Collector {
  return new DockerStatsCollector(options);
}
