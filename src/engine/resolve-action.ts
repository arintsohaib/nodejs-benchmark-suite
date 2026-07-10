import {
  isPackageManagerAction,
  resolvePackageManagerAction,
} from "../adapters/package-managers/index.js";
import { BenchError } from "../errors/bench-error.js";
import { resolveOnPath } from "../runners/native/discover.js";
import { assertNoShellAction } from "../security/shell-forbid.js";
import type { MatrixCell, ResolvedStage } from "./types.js";

/** Actions executable without package-manager adapters. */
export const RAW_COMMAND_ACTION = "raw.command" as const;

export type ResolvedCommand = {
  readonly command: string;
  readonly args: readonly string[];
  readonly extraEnv?: Readonly<Record<string, string>>;
};

export type ResolveStageCommandOptions = {
  readonly stage: ResolvedStage;
  readonly cell: MatrixCell;
  /** Run-scoped cache root for this cell (`…/_caches/<cellId>`). */
  readonly cacheDir: string;
  /** Host resolves binaries; container keeps tool names. Default: host. */
  readonly executionTarget?: "host" | "container";
};

function packageManagerFromCell(cell: MatrixCell): string {
  const raw = cell.axes["packageManager"];
  if (raw === undefined) {
    throw new BenchError(
      "INVALID_PROFILE",
      'Package-manager actions require matrix axis "packageManager" (npm|pnpm|yarn)',
      { axes: cell.axes },
    );
  }
  return String(raw);
}

/**
 * Map a resolved stage (+ matrix cell) to an argv spawn and optional extraEnv.
 */
export function resolveStageCommand(options: ResolveStageCommandOptions): ResolvedCommand {
  const { stage, cell, cacheDir } = options;
  const target = options.executionTarget ?? "host";
  const inContainer = target === "container";

  assertNoShellAction(stage.action, stage.id);

  if (stage.action === RAW_COMMAND_ACTION) {
    const commandName = stage.command;
    if (commandName === undefined || commandName === "") {
      throw new BenchError(
        "INVALID_PROFILE",
        `Stage "${stage.id}" uses ${RAW_COMMAND_ACTION} but is missing "command"`,
        { stageId: stage.id },
      );
    }

    const args = stage.args ?? [];
    if (commandName === "node" || commandName === "$NODE") {
      return { command: inContainer ? "node" : process.execPath, args };
    }

    if (inContainer) {
      return { command: commandName, args };
    }

    const resolved = resolveOnPath(commandName);
    if (resolved === undefined) {
      throw new BenchError("TOOL_NOT_FOUND", `Command not found on PATH: ${commandName}`, {
        command: commandName,
        stageId: stage.id,
      });
    }
    return { command: resolved, args };
  }

  if (isPackageManagerAction(stage.action)) {
    const pm = packageManagerFromCell(cell);
    const mapped = resolvePackageManagerAction({
      packageManager: pm,
      action: stage.action,
      cacheDir,
      resolveBinary: !inContainer,
    });
    return {
      command: mapped.command,
      args: mapped.args,
      extraEnv: mapped.extraEnv,
    };
  }

  throw new BenchError(
    "NOT_IMPLEMENTED",
    `Action "${stage.action}" is not supported. Use "${RAW_COMMAND_ACTION}" or packageManager.*/project.* actions.`,
    { action: stage.action, stageId: stage.id },
  );
}
