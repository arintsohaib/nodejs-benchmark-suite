import type { MetricAggregate } from "../metrics/types.js";
import { formatBytes, formatNumber, renderCitationBlock, truncateText } from "./format.js";
import type { Reporter, RunArtifact, StageResult } from "./types.js";

function groupDurationAggregates(
  aggregates: readonly MetricAggregate[],
): Map<string, MetricAggregate[]> {
  const byStage = new Map<string, MetricAggregate[]>();
  for (const aggregate of aggregates) {
    if (aggregate.metric !== "durationMs") {
      continue;
    }
    const list = byStage.get(aggregate.stageId) ?? [];
    list.push(aggregate);
    byStage.set(aggregate.stageId, list);
  }
  for (const list of byStage.values()) {
    list.sort((a, b) => a.cellId.localeCompare(b.cellId));
  }
  return byStage;
}

function renderResultsTables(aggregates: readonly MetricAggregate[]): string[] {
  const byStage = groupDurationAggregates(aggregates);
  const stageIds = [...byStage.keys()].sort((a, b) => a.localeCompare(b));
  if (stageIds.length === 0) {
    return ["_No duration aggregates._", ""];
  }

  const lines: string[] = [];
  for (const stageId of stageIds) {
    const rows = byStage.get(stageId) ?? [];
    lines.push(`### Stage: ${stageId}`);
    lines.push("");
    lines.push("| Cell | median ms | mean ms | p95 ms | n |");
    lines.push("|------|-----------|---------|--------|---|");
    for (const row of rows) {
      lines.push(
        `| ${row.cellId} | ${formatNumber(row.stats.median)} | ${formatNumber(row.stats.mean)} | ${formatNumber(row.stats.p95)} | ${row.stats.count} |`,
      );
    }
    lines.push("");
  }
  return lines;
}

function renderFailedStages(results: readonly StageResult[]): string[] {
  const failed = results.filter((result) => result.status === "failed");
  if (failed.length === 0) {
    return [];
  }
  const lines = ["### Failed stages", ""];
  for (const result of failed) {
    lines.push(
      `- \`${result.cellId}\` / \`${result.stageId}\` iteration ${result.iteration} (${result.iterationKind})`,
    );
  }
  lines.push("");
  return lines;
}

function renderPartialBanner(status: RunArtifact["status"]): string[] {
  if (status === "completed") {
    return [];
  }
  const label = status === "partial" ? "Partial run" : "Failed run";
  return [
    `> **${label}** — completed stages are included below; see failed stages and warnings.`,
    "",
  ];
}

/** Pure Markdown render of a RunArtifact (no I/O). */
export function renderMarkdownSummary(artifact: RunArtifact): string {
  const toolchainLines = Object.entries(artifact.environment.toolchains)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, info]) => `- ${name}: ${info.version} (\`${info.path}\`)`);

  const lines: string[] = [
    `# Benchmark Report — ${artifact.runId}`,
    "",
    ...renderPartialBanner(artifact.status),
    "## Snapshot",
    "",
    `- Suite: ${artifact.suiteVersion}`,
    `- Status: ${artifact.status}`,
    `- Profile: \`${artifact.profile.id}\` (digest \`${artifact.profile.digest}\`)`,
    `- Profile path: \`${artifact.profile.path}\``,
    `- Runner mode: ${artifact.environment.mode}`,
    `- Iterations: warmup ${artifact.plan.warmup}, measured ${artifact.plan.measured}`,
    `- Cells: ${artifact.plan.cellCount}`,
    `- Stages: ${artifact.plan.stageIds.join(", ") || "(none)"}`,
    "",
    "## Environment",
    "",
    `- OS: ${artifact.environment.os.platform} ${artifact.environment.os.release}${
      artifact.environment.os.distro !== undefined ? ` (${artifact.environment.os.distro})` : ""
    }`,
    `- CPU: ${artifact.environment.cpu.model} (${artifact.environment.cpu.coresLogical} logical, ${artifact.environment.cpu.arch})`,
    `- Memory: ${formatBytes(artifact.environment.memory.totalBytes)}`,
  ];

  if (toolchainLines.length > 0) {
    lines.push("- Toolchains:");
    lines.push(...toolchainLines.map((line) => `  ${line}`));
  }
  lines.push("");

  lines.push("## Results");
  lines.push("");
  lines.push(...renderResultsTables(artifact.aggregates));
  lines.push(...renderFailedStages(artifact.results));

  lines.push("## Notes / Warnings");
  lines.push("");
  if (artifact.warnings.length === 0) {
    lines.push("- (none)");
  } else {
    for (const warning of artifact.warnings) {
      lines.push(`- ${truncateText(warning, 2000)}`);
    }
  }
  lines.push("");

  lines.push(
    renderCitationBlock({
      suiteVersion: artifact.suiteVersion,
      runId: artifact.runId,
      profileId: artifact.profile.id,
      profileDigest: artifact.profile.digest,
      mode: artifact.environment.mode,
    }).trimEnd(),
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export class MarkdownReporter implements Reporter {
  readonly id = "markdown";

  async render(artifact: RunArtifact, outDir: string): Promise<void> {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await mkdir(outDir, { recursive: true });
    const body = renderMarkdownSummary(artifact);
    await writeFile(join(outDir, "summary.md"), body, "utf8");
  }
}

export function createMarkdownReporter(): Reporter {
  return new MarkdownReporter();
}
