import { BenchError } from "../../errors/bench-error.js";
import type { DockerMountMode, DockerMountPlan } from "./types.js";

const SUPPORTED: readonly DockerMountMode[] = ["bind", "named-volume"];

/**
 * Plan Docker mount args for a cell workspace.
 * S13 supports `bind` and `named-volume` only.
 */
export function planMount(options: {
  readonly mode: string;
  readonly hostWorkspacePath: string;
  readonly workdir: string;
  readonly volumeName: string;
}): DockerMountPlan {
  if (!SUPPORTED.includes(options.mode as DockerMountMode)) {
    throw new BenchError(
      "NOT_IMPLEMENTED",
      `Docker mount mode "${options.mode}" is not supported yet (S13: bind | named-volume)`,
      { mode: options.mode },
    );
  }

  const mode = options.mode as DockerMountMode;
  const workdir = options.workdir;

  if (mode === "bind") {
    return {
      mode,
      workdir,
      createArgs: ["-v", `${options.hostWorkspacePath}:${workdir}`],
    };
  }

  return {
    mode,
    workdir,
    createArgs: ["-v", `${options.volumeName}:${workdir}`],
    volumeName: options.volumeName,
  };
}

export function resourceCreateArgs(options: {
  readonly cpus?: number;
  readonly memory?: string;
  readonly pidsLimit?: number;
  readonly network?: string;
}): string[] {
  const args: string[] = [];
  if (options.cpus !== undefined) {
    args.push("--cpus", String(options.cpus));
  }
  if (options.memory !== undefined && options.memory !== "") {
    args.push("--memory", options.memory);
  }
  if (options.pidsLimit !== undefined) {
    args.push("--pids-limit", String(options.pidsLimit));
  }
  if (options.network !== undefined && options.network !== "") {
    args.push("--network", options.network);
  }
  return args;
}
