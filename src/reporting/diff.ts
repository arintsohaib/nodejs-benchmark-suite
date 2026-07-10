import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { formatNumber } from "./format.js";
import type { ReportDiff, RunArtifact } from "./types.js";

export type DiffRow = ReportDiff["rows"][number] & {
  readonly presence: "both" | "left-only" | "right-only";
};

export type ReportDiffResult = Omit<ReportDiff, "rows"> & {
  readonly rows: readonly DiffRow[];
  readonly leftProfileDigest: string;
  readonly rightProfileDigest: string;
};

function aggregateKey(stageId: string, metric: string, cellKey: string): string {
  return `${stageId}\0${metric}\0${cellKey}`;
}

/**
 * Compare two run artifacts on median aggregates.
 * Join key: `(stageId, metric, cellId)` — cell ids already normalize axis order.
 */
export function diffRunArtifacts(
  left: RunArtifact,
  right: RunArtifact,
  options: { readonly metric?: string } = {},
): ReportDiffResult {
  const metricFilter = options.metric;
  const leftMap = new Map<
    string,
    { median: number; stageId: string; metric: string; cellKey: string }
  >();
  const rightMap = new Map<
    string,
    { median: number; stageId: string; metric: string; cellKey: string }
  >();

  for (const row of left.aggregates) {
    if (metricFilter !== undefined && row.metric !== metricFilter) {
      continue;
    }
    leftMap.set(aggregateKey(row.stageId, row.metric, row.cellId), {
      median: row.stats.median,
      stageId: row.stageId,
      metric: row.metric,
      cellKey: row.cellId,
    });
  }
  for (const row of right.aggregates) {
    if (metricFilter !== undefined && row.metric !== metricFilter) {
      continue;
    }
    rightMap.set(aggregateKey(row.stageId, row.metric, row.cellId), {
      median: row.stats.median,
      stageId: row.stageId,
      metric: row.metric,
      cellKey: row.cellId,
    });
  }

  const keys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const rows: DiffRow[] = [];
  for (const key of [...keys].sort()) {
    const l = leftMap.get(key);
    const r = rightMap.get(key);
    const stageId = l?.stageId ?? r?.stageId ?? "";
    const metric = l?.metric ?? r?.metric ?? "";
    const cellKey = l?.cellKey ?? r?.cellKey ?? "";
    if (l !== undefined && r !== undefined) {
      const deltaAbsolute = r.median - l.median;
      const deltaPercent = l.median === 0 ? undefined : (deltaAbsolute / l.median) * 100;
      rows.push({
        stageId,
        metric,
        cellKey,
        leftMedian: l.median,
        rightMedian: r.median,
        deltaAbsolute,
        ...(deltaPercent !== undefined ? { deltaPercent } : {}),
        presence: "both",
      });
    } else if (l !== undefined) {
      rows.push({
        stageId,
        metric,
        cellKey,
        leftMedian: l.median,
        presence: "left-only",
      });
    } else if (r !== undefined) {
      rows.push({
        stageId,
        metric,
        cellKey,
        rightMedian: r.median,
        presence: "right-only",
      });
    }
  }

  return {
    leftRunId: left.runId,
    rightRunId: right.runId,
    leftProfileDigest: left.profile.digest,
    rightProfileDigest: right.profile.digest,
    rows,
  };
}

/** Markdown render of a report diff. */
export function renderDiffMarkdown(diff: ReportDiffResult): string {
  const lines: string[] = [
    "# Report Diff",
    "",
    `- Left: \`${diff.leftRunId}\` (profile digest \`${diff.leftProfileDigest}\`)`,
    `- Right: \`${diff.rightRunId}\` (profile digest \`${diff.rightProfileDigest}\`)`,
    "",
    "| Stage | Metric | Cell | Left median | Right median | Δ abs | Δ % | Notes |",
    "|-------|--------|------|-------------|--------------|-------|-----|-------|",
  ];

  for (const row of diff.rows) {
    const left = row.leftMedian !== undefined ? formatNumber(row.leftMedian) : "—";
    const right = row.rightMedian !== undefined ? formatNumber(row.rightMedian) : "—";
    const abs = row.deltaAbsolute !== undefined ? formatNumber(row.deltaAbsolute) : "—";
    const pct = row.deltaPercent !== undefined ? `${formatNumber(row.deltaPercent)}%` : "—";
    let notes = "";
    if (row.presence === "left-only") {
      notes = "missing on right";
    } else if (row.presence === "right-only") {
      notes = "missing on left";
    }
    lines.push(
      `| ${row.stageId} | ${row.metric} | ${row.cellKey} | ${left} | ${right} | ${abs} | ${pct} | ${notes} |`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export type WriteDiffOptions = {
  readonly outDir: string;
};

export type WriteDiffResult = {
  readonly diffMdPath: string;
  readonly diffJsonPath: string;
};

/** Write `diff.md` + `diff.json` under outDir. */
export async function writeReportDiff(
  diff: ReportDiffResult,
  options: WriteDiffOptions,
): Promise<WriteDiffResult> {
  await mkdir(options.outDir, { recursive: true });
  const diffMdPath = join(options.outDir, "diff.md");
  const diffJsonPath = join(options.outDir, "diff.json");
  await writeFile(diffMdPath, renderDiffMarkdown(diff), "utf8");
  await writeFile(diffJsonPath, `${JSON.stringify(diff, null, 2)}\n`, "utf8");
  return { diffMdPath, diffJsonPath };
}
