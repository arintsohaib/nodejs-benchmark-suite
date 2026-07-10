import type { JsBenchConfig } from "../config/types.js";
import { ExitCode } from "../errors/bench-error.js";
import type { Logger } from "../logging/logger.js";
import { buildLeaderboardFromReports, writeLeaderboard } from "../reporting/write-leaderboard.js";
import { SUITE_VERSION } from "../version.js";

export type LeaderboardCommandOptions = {
  readonly from: string;
  readonly out?: string;
  readonly metric?: string;
};

/**
 * Index local run artifacts into a shareable leaderboard directory (no upload).
 */
export async function cmdLeaderboard(
  options: LeaderboardCommandOptions,
  _config: JsBenchConfig,
  logger: Logger,
): Promise<number> {
  const doc = await buildLeaderboardFromReports(options.from, {
    suiteVersion: SUITE_VERSION,
    ...(options.metric !== undefined ? { metricFilter: options.metric } : {}),
  });
  const outDir = options.out ?? "leaderboard";
  const written = await writeLeaderboard(doc, outDir);
  logger.info("Wrote local leaderboard", {
    entries: doc.entries.length,
    outDir: written.outDir,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        entries: doc.entries.length,
        outDir: written.outDir,
        leaderboardJson: "leaderboard.json",
        leaderboardMd: "leaderboard.md",
        paths: written,
      },
      null,
      2,
    )}\n`,
  );
  return ExitCode.Success;
}
