import type { RunArtifact } from "./types.js";

export const LEADERBOARD_SCHEMA_VERSION = 1 as const;
export const LEADERBOARD_KIND = "jsbench-leaderboard" as const;

export const LEADERBOARD_DISCLAIMER =
  "Local-first index of run summaries. Not a ranking. Compare only entries with the same profile digest and comparable environments. The suite does not crown a best result.";

export type LeaderboardMedian = {
  readonly stageId: string;
  readonly metric: string;
  readonly cellId: string;
  readonly median: number;
  readonly unit: string;
};

export type LeaderboardEntry = {
  readonly runId: string;
  readonly suiteVersion: string;
  readonly status: RunArtifact["status"];
  readonly profile: {
    readonly id: string;
    readonly digest: string;
  };
  readonly environment: {
    readonly mode: "native" | "docker";
    readonly os: {
      readonly platform: string;
      readonly release: string;
      readonly distro?: string;
    };
    readonly cpu: {
      readonly model: string;
      readonly coresLogical: number;
      readonly arch: string;
    };
    readonly docker?: {
      readonly imageRef?: string;
      readonly mount?: string;
    };
  };
  readonly medians: readonly LeaderboardMedian[];
  readonly sourcePath?: string;
};

export type LeaderboardDocument = {
  readonly schemaVersion: typeof LEADERBOARD_SCHEMA_VERSION;
  readonly kind: typeof LEADERBOARD_KIND;
  readonly createdAt: string;
  readonly suiteVersion: string;
  readonly metricFilter?: string;
  readonly disclaimer: string;
  readonly entries: readonly LeaderboardEntry[];
};

export type BuildLeaderboardOptions = {
  readonly suiteVersion: string;
  readonly createdAt?: string;
  /** Only include this metric in medians (default: durationMs). */
  readonly metricFilter?: string;
};

/**
 * Build a slim, shareable local leaderboard document from full run artifacts.
 * Entries are sorted by runId (stable, not by performance).
 */
export function buildLeaderboard(
  artifacts: ReadonlyArray<{ readonly artifact: RunArtifact; readonly sourcePath?: string }>,
  options: BuildLeaderboardOptions,
): LeaderboardDocument {
  const metricFilter = options.metricFilter ?? "durationMs";
  const entries: LeaderboardEntry[] = artifacts.map(({ artifact, sourcePath }) => {
    const medians: LeaderboardMedian[] = artifact.aggregates
      .filter((row) => row.metric === metricFilter)
      .map((row) => ({
        stageId: row.stageId,
        metric: row.metric,
        cellId: row.cellId,
        median: row.stats.median,
        unit: row.unit,
      }))
      .sort((a, b) => {
        const left = `${a.stageId}|${a.cellId}|${a.metric}`;
        const right = `${b.stageId}|${b.cellId}|${b.metric}`;
        return left.localeCompare(right);
      });

    const docker =
      artifact.environment.docker !== undefined
        ? {
            ...(artifact.environment.docker.imageRef !== undefined
              ? { imageRef: artifact.environment.docker.imageRef }
              : {}),
            ...(artifact.environment.docker.mount !== undefined
              ? { mount: artifact.environment.docker.mount }
              : {}),
          }
        : undefined;

    return {
      runId: artifact.runId,
      suiteVersion: artifact.suiteVersion,
      status: artifact.status,
      profile: {
        id: artifact.profile.id,
        digest: artifact.profile.digest,
      },
      environment: {
        mode: artifact.environment.mode,
        os: {
          platform: artifact.environment.os.platform,
          release: artifact.environment.os.release,
          ...(artifact.environment.os.distro !== undefined
            ? { distro: artifact.environment.os.distro }
            : {}),
        },
        cpu: {
          model: artifact.environment.cpu.model,
          coresLogical: artifact.environment.cpu.coresLogical,
          arch: artifact.environment.cpu.arch,
        },
        ...(docker !== undefined && Object.keys(docker).length > 0 ? { docker } : {}),
      },
      medians,
      ...(sourcePath !== undefined ? { sourcePath } : {}),
    };
  });

  entries.sort((a, b) => a.runId.localeCompare(b.runId));

  return {
    schemaVersion: LEADERBOARD_SCHEMA_VERSION,
    kind: LEADERBOARD_KIND,
    createdAt: options.createdAt ?? new Date().toISOString(),
    suiteVersion: options.suiteVersion,
    metricFilter,
    disclaimer: LEADERBOARD_DISCLAIMER,
    entries,
  };
}

/** Markdown render — factual tables, no winner language. */
export function renderLeaderboardMarkdown(doc: LeaderboardDocument): string {
  const lines: string[] = [
    "# jsbench local leaderboard",
    "",
    `> ${doc.disclaimer}`,
    "",
    `- Created: \`${doc.createdAt}\``,
    `- Builder suite version: \`${doc.suiteVersion}\``,
    `- Metric filter: \`${doc.metricFilter ?? "durationMs"}\``,
    `- Entries: ${doc.entries.length}`,
    "",
  ];

  const byDigest = new Map<string, LeaderboardEntry[]>();
  for (const entry of doc.entries) {
    const key = `${entry.profile.id}@${entry.profile.digest}`;
    const list = byDigest.get(key) ?? [];
    list.push(entry);
    byDigest.set(key, list);
  }

  for (const [key, group] of [...byDigest.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## Profile \`${key}\``);
    lines.push("");
    lines.push("| Run ID | Status | Mode | CPU | Stage / cell | Median |");
    lines.push("|--------|--------|------|-----|--------------|--------|");
    for (const entry of group) {
      if (entry.medians.length === 0) {
        lines.push(
          `| \`${entry.runId}\` | ${entry.status} | ${entry.environment.mode} | ${entry.environment.cpu.model} (${entry.environment.cpu.coresLogical}c) | — | — |`,
        );
        continue;
      }
      for (const median of entry.medians) {
        lines.push(
          `| \`${entry.runId}\` | ${entry.status} | ${entry.environment.mode} | ${entry.environment.cpu.model} (${entry.environment.cpu.coresLogical}c) | ${median.stageId} / ${median.cellId} | ${median.median} ${median.unit} |`,
        );
      }
    }
    lines.push("");
  }

  if (doc.entries.length === 0) {
    lines.push("_No runs found._");
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
