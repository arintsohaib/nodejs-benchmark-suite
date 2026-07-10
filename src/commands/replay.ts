import { resolve } from "node:path";
import type { JsBenchConfig } from "../config/types.js";
import { executeRun } from "../engine/execute.js";
import { createRunPlan } from "../engine/plan.js";
import { BenchError, ExitCode } from "../errors/bench-error.js";
import type { Logger } from "../logging/logger.js";
import { loadProfile } from "../profiles/load-profile.js";
import { resolveProfileRef } from "../profiles/resolve-profile-ref.js";
import { loadRunArtifact } from "../reporting/load-run-artifact.js";
import { buildReplayPlan } from "../reporting/replay-plan.js";

export type ReplayCommandOptions = {
  readonly execute?: boolean;
  readonly force?: boolean;
  readonly continueOnError?: boolean;
};

/**
 * Print a reproduction brief from a historical run, optionally re-execute the profile.
 */
export async function cmdReplay(
  runPath: string,
  options: ReplayCommandOptions,
  config: JsBenchConfig,
  logger: Logger,
): Promise<number> {
  const artifact = await loadRunArtifact(resolve(runPath));
  const replayPlan = buildReplayPlan(artifact);

  if (options.execute !== true) {
    logger.info("Replay plan ready (hints only; pass --execute to re-run)", {
      sourceRunId: artifact.runId,
      profileId: artifact.profile.id,
    });
    process.stdout.write(`${JSON.stringify({ mode: "hints", plan: replayPlan }, null, 2)}\n`);
    return ExitCode.Success;
  }

  const profilePath = await resolveProfileRef(artifact.profile.id, {
    profilesDir: config.profilesDir,
  });
  const loaded = await loadProfile(profilePath);

  if (loaded.digest !== artifact.profile.digest) {
    const message = `Profile digest mismatch for ${artifact.profile.id}: historical=${artifact.profile.digest} local=${loaded.digest}`;
    if (options.force === true) {
      logger.warn(message, { force: true });
    } else {
      throw new BenchError(
        "VALIDATION_ERROR",
        `${message}. Re-run with --force to proceed anyway.`,
        {
          profileId: artifact.profile.id,
          historicalDigest: artifact.profile.digest,
          localDigest: loaded.digest,
        },
      );
    }
  }

  const plan = createRunPlan({
    profile: loaded.profile,
    profileDigest: loaded.digest,
  });
  logger.info("Replaying run from historical artifact", {
    sourceRunId: artifact.runId,
    profileId: loaded.profile.id,
    profileDigest: loaded.digest,
  });
  const result = await executeRun({
    plan,
    profilePath: loaded.path,
    config,
    logger,
    continueOnError: options.continueOnError === true,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "execute",
        sourceRunId: artifact.runId,
        plan: replayPlan,
        ok: result.exitCode === ExitCode.Success,
        runId: result.artifact.runId,
        status: result.artifact.status,
        outDir: result.outDir,
        runJson: result.runJsonPath,
        summaryMd: result.summaryMdPath,
        exitCode: result.exitCode,
        profileDigestMatched: loaded.digest === artifact.profile.digest,
      },
      null,
      2,
    )}\n`,
  );
  return result.exitCode;
}
