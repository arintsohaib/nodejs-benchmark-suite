/**
 * Docker runner types (CLI-based v1).
 * @see docs/06_DOCKER_BENCHMARK.md
 */

export type DockerMountMode = "bind" | "named-volume" | "copy-in" | "tmpfs";

export type DockerPullPolicy = "always" | "if-missing" | "never";

export type DockerCliResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type DockerCli = {
  /** Run `docker <args>` on the host. */
  exec(
    args: readonly string[],
    options?: { readonly timeoutMs?: number },
  ): Promise<DockerCliResult>;
};

export type ResolvedDockerImage = {
  readonly imageRef: string;
  readonly imagePolicy: string;
  readonly imageDigest?: string;
};

export type DockerMountPlan = {
  readonly mode: DockerMountMode;
  readonly workdir: string;
  /** Args appended to `docker create` (e.g. `-v …`). */
  readonly createArgs: readonly string[];
  readonly volumeName?: string;
};

export type DockerResourceLimits = {
  readonly cpus?: number;
  readonly memory?: string;
  readonly pidsLimit?: number;
  readonly network?: string;
};

export type DockerSession = {
  readonly containerName: string;
  readonly image: ResolvedDockerImage;
  readonly mount: DockerMountPlan;
  readonly limits: DockerResourceLimits;
  readonly workdir: string;
};
