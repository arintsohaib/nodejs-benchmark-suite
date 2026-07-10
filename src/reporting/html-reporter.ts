import type { MetricAggregate } from "../metrics/types.js";
import {
  escapeHtml,
  formatBytes,
  formatNumber,
  formatProfileTierLabel,
  inferProfileTier,
  truncateText,
} from "./format.js";
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

function maxMedian(aggregates: readonly MetricAggregate[]): number {
  let max = 0;
  for (const row of aggregates) {
    if (row.metric === "durationMs" && row.stats.median > max) {
      max = row.stats.median;
    }
  }
  return max > 0 ? max : 1;
}

function statusBanner(status: RunArtifact["status"]): string {
  if (status === "completed") {
    return "";
  }
  const label = status === "partial" ? "Partial run" : "Failed run";
  return `<div class="banner ${status}"><strong>${escapeHtml(label)}</strong> — see failed stages and warnings below.</div>\n`;
}

/** Pure HTML render of a RunArtifact (self-contained, inline CSS). */
export function renderHtmlReport(artifact: RunArtifact): string {
  const byStage = groupDurationAggregates(artifact.aggregates);
  const stageIds = [...byStage.keys()].sort((a, b) => a.localeCompare(b));
  const scale = maxMedian(artifact.aggregates);
  const failed = artifact.results.filter((r) => r.status === "failed");

  const toolchainRows = Object.entries(artifact.environment.toolchains)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, info]) =>
        `<li><code>${escapeHtml(name)}</code>: ${escapeHtml(info.version)} (<code>${escapeHtml(info.path)}</code>)</li>`,
    )
    .join("\n");

  const stageSections = stageIds
    .map((stageId) => {
      const rows = byStage.get(stageId) ?? [];
      const tableRows = rows
        .map((row) => {
          const width = Math.max(2, Math.round((row.stats.median / scale) * 100));
          return `<tr>
  <td><code>${escapeHtml(row.cellId)}</code></td>
  <td>${formatNumber(row.stats.median)}</td>
  <td>${formatNumber(row.stats.mean)}</td>
  <td>${formatNumber(row.stats.p95)}</td>
  <td>${row.stats.count}</td>
  <td><span class="bar" style="width:${width}%"></span></td>
</tr>`;
        })
        .join("\n");
      return `<h3>Stage: ${escapeHtml(stageId)}</h3>
<table>
<thead><tr><th>Cell</th><th>median ms</th><th>mean ms</th><th>p95 ms</th><th>n</th><th></th></tr></thead>
<tbody>
${tableRows}
</tbody>
</table>`;
    })
    .join("\n");

  const failedList =
    failed.length === 0
      ? ""
      : `<h3>Failed stages</h3>
<ul>
${failed
  .map(
    (r: StageResult) =>
      `<li><code>${escapeHtml(r.cellId)}</code> / <code>${escapeHtml(r.stageId)}</code> iteration ${r.iteration} (${escapeHtml(r.iterationKind)})</li>`,
  )
  .join("\n")}
</ul>`;

  const warnings =
    artifact.warnings.length === 0
      ? "<li>(none)</li>"
      : artifact.warnings.map((w) => `<li>${escapeHtml(truncateText(w, 2000))}</li>`).join("\n");

  const citationBlock = `<h2>Citation</h2>
<p>When citing these results, include at least:</p>
<ul>
<li>Suite version: <code>${escapeHtml(artifact.suiteVersion)}</code></li>
<li>Run id: <code>${escapeHtml(artifact.runId)}</code></li>
<li>Profile: <code>${escapeHtml(artifact.profile.id)}</code> (digest <code>${escapeHtml(artifact.profile.digest)}</code>, tier: ${escapeHtml(formatProfileTierLabel(inferProfileTier(artifact.profile.id)))})</li>
<li>Runner mode: ${escapeHtml(artifact.environment.mode)}</li>
<li>Hardware / OS summary from the Environment section</li>
<li>Cold/warm and network policy from the profile stages</li>
<li>Attach or link the immutable <code>run.json</code> for this run</li>
</ul>
<p>Do not claim package-manager or hardware “winners” from a single run.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Benchmark Report — ${escapeHtml(artifact.runId)}</title>
<style>
:root { --fg:#1a1a1a; --muted:#555; --border:#ccc; --bg:#fafafa; --accent:#2563eb; --warn:#b45309; --fail:#b91c1c; }
body { font-family: ui-sans-serif, system-ui, sans-serif; color:var(--fg); background:var(--bg); margin:0; padding:1.5rem; line-height:1.45; }
main { max-width: 960px; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 1rem; }
h2 { font-size: 1.15rem; margin: 1.5rem 0 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
h3 { font-size: 1rem; margin: 1rem 0 0.5rem; }
table { border-collapse: collapse; width: 100%; margin: 0.5rem 0 1rem; font-size: 0.9rem; }
th, td { border: 1px solid var(--border); padding: 0.35rem 0.5rem; text-align: left; }
th { background: #eee; }
code { font-family: ui-monospace, monospace; font-size: 0.85em; }
.meta { color: var(--muted); font-size: 0.95rem; }
.banner { padding: 0.75rem 1rem; border-radius: 4px; margin: 0 0 1rem; background: #fff7ed; border: 1px solid #fdba74; color: var(--warn); }
.banner.failed { background: #fef2f2; border-color: #fca5a5; color: var(--fail); }
.bar { display:inline-block; height: 0.65rem; background: var(--accent); border-radius: 2px; vertical-align: middle; min-width: 2px; }
ul { padding-left: 1.25rem; }
</style>
</head>
<body>
<main>
<h1>Benchmark Report — ${escapeHtml(artifact.runId)}</h1>
${statusBanner(artifact.status)}
<h2>Snapshot</h2>
<ul class="meta">
<li>Suite: ${escapeHtml(artifact.suiteVersion)}</li>
<li>Status: ${escapeHtml(artifact.status)}</li>
<li>Profile: <code>${escapeHtml(artifact.profile.id)}</code> (digest <code>${escapeHtml(artifact.profile.digest)}</code>)</li>
<li>Profile tier: ${escapeHtml(formatProfileTierLabel(inferProfileTier(artifact.profile.id)))}</li>
<li>Profile path: <code>${escapeHtml(artifact.profile.path)}</code></li>
<li>Runner mode: ${escapeHtml(artifact.environment.mode)}</li>
<li>Iterations: warmup ${artifact.plan.warmup}, measured ${artifact.plan.measured}</li>
<li>Cells: ${artifact.plan.cellCount}</li>
<li>Stages: ${escapeHtml(artifact.plan.stageIds.join(", ") || "(none)")}</li>
</ul>
<h2>Environment</h2>
<ul class="meta">
<li>OS: ${escapeHtml(artifact.environment.os.platform)} ${escapeHtml(artifact.environment.os.release)}${
    artifact.environment.os.distro !== undefined
      ? ` (${escapeHtml(artifact.environment.os.distro)})`
      : ""
  }</li>
<li>CPU: ${escapeHtml(artifact.environment.cpu.model)} (${artifact.environment.cpu.coresLogical} logical, ${escapeHtml(artifact.environment.cpu.arch)})</li>
<li>Memory: ${escapeHtml(formatBytes(artifact.environment.memory.totalBytes))}</li>
<li>Toolchains:<ul>${toolchainRows}</ul></li>
</ul>
<h2>Results</h2>
${stageSections.length > 0 ? stageSections : "<p><em>No duration aggregates.</em></p>"}
${failedList}
<h2>Notes / Warnings</h2>
<ul>
${warnings}
</ul>
${citationBlock}
</main>
</body>
</html>
`;
}

export class HtmlReporter implements Reporter {
  readonly id = "html";

  async render(artifact: RunArtifact, outDir: string): Promise<void> {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "index.html"), renderHtmlReport(artifact), "utf8");
  }
}

export function createHtmlReporter(): Reporter {
  return new HtmlReporter();
}
