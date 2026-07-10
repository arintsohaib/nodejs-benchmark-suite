import { ExitCode } from "../errors/bench-error.js";
import type { Logger } from "../logging/logger.js";
import { discoverDocker } from "../runners/docker/discover.js";
import { discoverNativeToolchains } from "../runners/native/discover.js";

export type DoctorResult = {
  readonly ok: boolean;
  readonly exitCode: ExitCode;
  readonly strictDoctor: boolean;
  readonly toolchains: {
    readonly node: { readonly path: string; readonly version: string };
    readonly npm?: { readonly path: string; readonly version: string };
    readonly pnpm?: { readonly path: string; readonly version: string };
    readonly yarn?: { readonly path: string; readonly version: string };
  };
  readonly docker?: {
    readonly available: boolean;
    readonly path?: string;
    readonly version?: string;
  };
  readonly checks: ReadonlyArray<{
    readonly id: string;
    readonly ok: boolean;
    readonly detail: string;
  }>;
};

/**
 * Prerequisite checks (Node required; package managers and Docker optional).
 */
export async function runDoctor(options: {
  readonly logger: Logger;
  readonly strictDoctor: boolean;
}): Promise<DoctorResult> {
  const checks: Array<{ id: string; ok: boolean; detail: string }> = [];

  try {
    const toolchains = await discoverNativeToolchains();
    checks.push({
      id: "node",
      ok: true,
      detail: `${toolchains.node.version} at ${toolchains.node.path}`,
    });

    for (const id of ["npm", "pnpm", "yarn"] as const) {
      const tool = toolchains[id];
      if (tool !== undefined) {
        checks.push({
          id,
          ok: true,
          detail: `${tool.version} at ${tool.path}`,
        });
      } else {
        checks.push({
          id,
          ok: false,
          detail: `${id} not found (optional unless selected by a profile matrix)`,
        });
      }
    }

    const docker = await discoverDocker();
    checks.push({
      id: "docker",
      ok: docker.available,
      detail: docker.detail,
    });

    const nodeOk = checks.some((check) => check.id === "node" && check.ok);
    const ok = nodeOk;
    const exitCode = ok ? ExitCode.Success : ExitCode.DoctorFailure;

    options.logger.info("Doctor checks complete", {
      ok,
      node: toolchains.node.version,
      npm: toolchains.npm?.version,
      pnpm: toolchains.pnpm?.version,
      yarn: toolchains.yarn?.version,
      docker: docker.available ? docker.version : undefined,
    });

    return {
      ok,
      exitCode,
      toolchains: {
        node: toolchains.node,
        ...(toolchains.npm !== undefined ? { npm: toolchains.npm } : {}),
        ...(toolchains.pnpm !== undefined ? { pnpm: toolchains.pnpm } : {}),
        ...(toolchains.yarn !== undefined ? { yarn: toolchains.yarn } : {}),
      },
      docker: {
        available: docker.available,
        ...(docker.path !== undefined ? { path: docker.path } : {}),
        ...(docker.version !== undefined ? { version: docker.version } : {}),
      },
      checks,
      strictDoctor: options.strictDoctor,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    checks.push({ id: "node", ok: false, detail });
    options.logger.error("Doctor failed", { detail });
    return {
      ok: false,
      exitCode: ExitCode.DoctorFailure,
      strictDoctor: options.strictDoctor,
      toolchains: {
        node: { path: "", version: "" },
      },
      checks,
    };
  }
}
