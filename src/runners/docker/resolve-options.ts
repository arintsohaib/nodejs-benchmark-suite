import type { MatrixCell } from "../../engine/types.js";
import type { BenchmarkProfile, DockerRunnerOptions } from "../../profiles/types.js";

/**
 * Merge profile docker options with matrix cell overrides (`mount`, etc.).
 */
export function resolveDockerOptions(
  profile: BenchmarkProfile,
  cell: MatrixCell,
): Required<
  Pick<
    DockerRunnerOptions,
    "imagePolicy" | "pull" | "mount" | "workdir" | "removeContainers" | "removeVolumes"
  >
> &
  DockerRunnerOptions {
  const base = profile.runner?.docker ?? {};
  const mountFromAxis = cell.axes["mount"];
  const mount = mountFromAxis !== undefined ? String(mountFromAxis) : (base.mount ?? "bind");

  return {
    imagePolicy: base.imagePolicy ?? "node-lts-bookworm-slim",
    pull: base.pull ?? "if-missing",
    mount: mount as "bind" | "named-volume" | "copy-in" | "tmpfs",
    workdir: base.workdir ?? "/workspace",
    removeContainers: base.removeContainers ?? "always",
    removeVolumes: base.removeVolumes ?? true,
    ...(base.cpus !== undefined ? { cpus: base.cpus } : {}),
    ...(base.memory !== undefined ? { memory: base.memory } : {}),
    ...(base.pidsLimit !== undefined ? { pidsLimit: base.pidsLimit } : {}),
    ...(base.network !== undefined ? { network: base.network } : {}),
  };
}
