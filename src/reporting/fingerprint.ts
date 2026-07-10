import { readFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { discoverNativeToolchains } from "../runners/native/discover.js";
import type { EnvironmentFingerprint, ToolchainInfo } from "./types.js";

export type CollectFingerprintOptions = {
  readonly mode?: "native" | "docker";
  readonly workspacePath?: string;
  /** Override toolchains (tests); default discovers Node/npm. */
  readonly toolchains?: Readonly<Record<string, ToolchainInfo>>;
  readonly docker?: EnvironmentFingerprint["docker"];
};

function readDistro(): string | undefined {
  try {
    const text = readFileSync("/etc/os-release", "utf8");
    const pretty = /^PRETTY_NAME=(.*)$/m.exec(text);
    if (pretty?.[1] !== undefined) {
      return pretty[1].replace(/^"|"$/g, "").trim();
    }
    const name = /^NAME=(.*)$/m.exec(text);
    if (name?.[1] !== undefined) {
      return name[1].replace(/^"|"$/g, "").trim();
    }
  } catch {
    // Non-Linux or unreadable — omit distro.
  }
  return undefined;
}

/**
 * Best-effort host fingerprint for native (and later Docker) runs.
 */
export async function collectEnvironmentFingerprint(
  options: CollectFingerprintOptions = {},
): Promise<EnvironmentFingerprint> {
  const cpuList = cpus();
  const firstCpu = cpuList[0];
  const toolchains =
    options.toolchains ??
    (await (async () => {
      const discovered = await discoverNativeToolchains();
      const map: Record<string, ToolchainInfo> = {
        node: { path: discovered.node.path, version: discovered.node.version },
      };
      if (discovered.npm !== undefined) {
        map["npm"] = { path: discovered.npm.path, version: discovered.npm.version };
      }
      if (discovered.pnpm !== undefined) {
        map["pnpm"] = { path: discovered.pnpm.path, version: discovered.pnpm.version };
      }
      if (discovered.yarn !== undefined) {
        map["yarn"] = { path: discovered.yarn.path, version: discovered.yarn.version };
      }
      return map;
    })());

  const distro = readDistro();
  const fingerprint: EnvironmentFingerprint = {
    mode: options.mode ?? "native",
    os: {
      platform: platform(),
      release: release(),
      ...(distro !== undefined ? { distro } : {}),
    },
    cpu: {
      model: firstCpu?.model.trim() || "unknown",
      coresLogical: Math.max(1, cpuList.length),
      arch: arch(),
    },
    memory: {
      totalBytes: totalmem(),
    },
    toolchains,
    ...(options.docker !== undefined ? { docker: options.docker } : {}),
  };

  if (options.workspacePath !== undefined) {
    return {
      ...fingerprint,
      disk: { workspacePath: options.workspacePath },
    };
  }
  return fingerprint;
}
