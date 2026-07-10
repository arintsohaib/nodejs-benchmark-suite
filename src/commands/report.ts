import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { JsBenchConfig } from "../config/types.js";
import { BenchError, ExitCode } from "../errors/bench-error.js";
import type { Logger } from "../logging/logger.js";
import { diffRunArtifacts, writeReportDiff } from "../reporting/diff.js";
import { createHtmlReporter } from "../reporting/html-reporter.js";
import { loadRunArtifact } from "../reporting/load-run-artifact.js";
import { createMarkdownReporter } from "../reporting/markdown-reporter.js";

/**
 * Re-render Markdown + HTML from an existing `run.json` (does not mutate run.json).
 */
export async function cmdReportRerender(
  runPath: string,
  _config: JsBenchConfig,
  logger: Logger,
): Promise<number> {
  const resolved = resolve(runPath);
  const info = await stat(resolved);
  const dir = info.isDirectory() ? resolved : dirname(resolved);
  const artifact = await loadRunArtifact(resolved);
  await createMarkdownReporter().render(artifact, dir);
  await createHtmlReporter().render(artifact, dir);
  logger.info("Re-rendered reports", {
    runId: artifact.runId,
    summaryMd: join(dir, "summary.md"),
    indexHtml: join(dir, "index.html"),
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        runId: artifact.runId,
        outDir: dir,
        summaryMd: "summary.md",
        indexHtml: "index.html",
      },
      null,
      2,
    )}\n`,
  );
  return ExitCode.Success;
}

/**
 * Diff two runs; write diff.md + diff.json under --out or cwd/diff-<left>-vs-<right>.
 */
export async function cmdReportDiff(
  leftPath: string,
  rightPath: string,
  options: { readonly out?: string },
  _config: JsBenchConfig,
  logger: Logger,
): Promise<number> {
  const left = await loadRunArtifact(resolve(leftPath));
  const right = await loadRunArtifact(resolve(rightPath));
  const diff = diffRunArtifacts(left, right);
  const outDir =
    options.out !== undefined
      ? resolve(options.out)
      : resolve(`diff-${left.runId}-vs-${right.runId}`);
  const written = await writeReportDiff(diff, { outDir });
  logger.info("Wrote report diff", {
    left: left.runId,
    right: right.runId,
    outDir,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        leftRunId: left.runId,
        rightRunId: right.runId,
        outDir,
        diffMd: "diff.md",
        diffJson: "diff.json",
        rowCount: diff.rows.length,
        paths: written,
      },
      null,
      2,
    )}\n`,
  );
  return ExitCode.Success;
}

export function parseReportArgs(positionals: readonly string[]): {
  readonly mode: "rerender" | "diff";
  readonly runPath?: string;
  readonly leftPath?: string;
  readonly rightPath?: string;
} {
  const sub = positionals[1];
  if (sub === "diff") {
    const leftPath = positionals[2];
    const rightPath = positionals[3];
    if (leftPath === undefined || rightPath === undefined) {
      throw new BenchError(
        "INVALID_CONFIG",
        "Usage: jsbench report diff <runA> <runB> [--out <dir>]",
      );
    }
    return { mode: "diff", leftPath, rightPath };
  }
  const runPath = sub;
  if (runPath === undefined) {
    throw new BenchError(
      "INVALID_CONFIG",
      "Usage: jsbench report <runDir> | jsbench report diff <runA> <runB>",
    );
  }
  return { mode: "rerender", runPath };
}
