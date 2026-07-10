import { resolveOnPath } from "../native/discover.js";
import { assertDockerDaemon, createDockerCli, dockerVersion } from "./cli.js";
import type { DockerCli } from "./types.js";

export type DockerDiscovery = {
  readonly available: boolean;
  readonly path?: string;
  readonly version?: string;
  readonly detail: string;
};

/**
 * Discover Docker CLI + daemon for doctor / fingerprints.
 */
export async function discoverDocker(
  cliFactory: () => DockerCli = createDockerCli,
): Promise<DockerDiscovery> {
  const override = process.env["JSBENCH_DOCKER"];
  const path =
    override !== undefined && override !== ""
      ? (resolveOnPath(override) ?? override)
      : resolveOnPath("docker");

  if (path === undefined) {
    return {
      available: false,
      detail: "docker CLI not found (optional unless runner.type is docker)",
    };
  }

  try {
    const cli = cliFactory();
    const version = await assertDockerDaemon(cli);
    return {
      available: true,
      path,
      version,
      detail: `${version} at ${path}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      path,
      detail: message,
    };
  }
}

export { dockerVersion };
