import { BenchError } from "../../errors/bench-error.js";
import { resourceCreateArgs } from "./mount-planner.js";
import type { DockerCli, DockerMountPlan, DockerSession, ResolvedDockerImage } from "./types.js";

export type CreateDockerSessionOptions = {
  readonly cli: DockerCli;
  readonly containerName: string;
  readonly image: ResolvedDockerImage;
  readonly mount: DockerMountPlan;
  readonly hostWorkspacePath: string;
  readonly cpus?: number;
  readonly memory?: string;
  readonly pidsLimit?: number;
  readonly network?: string;
};

/**
 * Populate a named volume from the host workspace (untimed setup).
 */
export async function populateNamedVolume(options: {
  readonly cli: DockerCli;
  readonly volumeName: string;
  readonly hostWorkspacePath: string;
  readonly workdir: string;
  readonly helperImage: string;
}): Promise<void> {
  const createVol = await options.cli.exec(["volume", "create", options.volumeName], {
    timeoutMs: 60_000,
  });
  if (createVol.exitCode !== 0) {
    throw new BenchError("DOCKER_ERROR", `Failed to create volume ${options.volumeName}`, {
      stderr: createVol.stderr.trim(),
    });
  }

  // Copy host tree into the volume via a short-lived helper container (not timed).
  const copy = await options.cli.exec(
    [
      "run",
      "--rm",
      "-v",
      `${options.volumeName}:${options.workdir}`,
      "-v",
      `${options.hostWorkspacePath}:/jsbench-src:ro`,
      options.helperImage,
      "sh",
      "-c",
      `mkdir -p ${options.workdir} && cp -a /jsbench-src/. ${options.workdir}/`,
    ],
    { timeoutMs: 300_000 },
  );
  if (copy.exitCode !== 0) {
    throw new BenchError("DOCKER_ERROR", `Failed to populate volume ${options.volumeName}`, {
      stderr: copy.stderr.trim(),
      exitCode: copy.exitCode,
    });
  }
}

/**
 * Create and start a long-lived container (`sleep infinity`) for timed `docker exec` stages.
 */
export async function createDockerSession(
  options: CreateDockerSessionOptions,
): Promise<DockerSession> {
  const { cli, containerName, image, mount } = options;
  const limits = {
    ...(options.cpus !== undefined ? { cpus: options.cpus } : {}),
    ...(options.memory !== undefined ? { memory: options.memory } : {}),
    ...(options.pidsLimit !== undefined ? { pidsLimit: options.pidsLimit } : {}),
    ...(options.network !== undefined ? { network: options.network } : {}),
  };

  if (mount.mode === "named-volume" && mount.volumeName !== undefined) {
    await populateNamedVolume({
      cli,
      volumeName: mount.volumeName,
      hostWorkspacePath: options.hostWorkspacePath,
      workdir: mount.workdir,
      helperImage: image.imageRef,
    });
  }

  const createArgs = [
    "create",
    "--name",
    containerName,
    "-w",
    mount.workdir,
    ...mount.createArgs,
    ...resourceCreateArgs(limits),
    image.imageRef,
    "sleep",
    "infinity",
  ];

  const created = await cli.exec(createArgs, { timeoutMs: 120_000 });
  if (created.exitCode !== 0) {
    throw new BenchError("DOCKER_ERROR", `docker create failed for ${containerName}`, {
      stderr: created.stderr.trim(),
      exitCode: created.exitCode,
    });
  }

  const started = await cli.exec(["start", containerName], { timeoutMs: 60_000 });
  if (started.exitCode !== 0) {
    await cli.exec(["rm", "-f", containerName], { timeoutMs: 60_000 }).catch(() => undefined);
    throw new BenchError("DOCKER_ERROR", `docker start failed for ${containerName}`, {
      stderr: started.stderr.trim(),
      exitCode: started.exitCode,
    });
  }

  return {
    containerName,
    image,
    mount,
    limits,
    workdir: mount.workdir,
  };
}

export async function removeDockerSession(options: {
  readonly cli: DockerCli;
  readonly session: DockerSession;
  readonly removeVolumes: boolean;
}): Promise<void> {
  await options.cli.exec(["rm", "-f", options.session.containerName], { timeoutMs: 60_000 });
  if (
    options.removeVolumes &&
    options.session.mount.mode === "named-volume" &&
    options.session.mount.volumeName !== undefined
  ) {
    await options.cli.exec(["volume", "rm", "-f", options.session.mount.volumeName], {
      timeoutMs: 60_000,
    });
  }
}
