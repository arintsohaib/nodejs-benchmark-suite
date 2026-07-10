import { spawn } from "node:child_process";
import { constants, accessSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { BenchError } from "../../errors/bench-error.js";
import type { ToolchainDiscovery } from "./types.js";

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a command name on PATH (no shell).
 * Absolute paths are returned as-is when executable.
 */
export function resolveOnPath(
  command: string,
  pathEnv: string | undefined = process.env["PATH"],
): string | undefined {
  if (command.includes("/") || command.includes("\\")) {
    return isExecutable(command) ? command : undefined;
  }
  if (pathEnv === undefined || pathEnv === "") {
    return undefined;
  }
  for (const dir of pathEnv.split(delimiter)) {
    if (dir === "") {
      continue;
    }
    const candidate = join(dir, command);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function readVersion(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new BenchError("TOOL_NOT_FOUND", `Timed out reading version for ${command}`, { command }),
      );
    }, 10_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        new BenchError("TOOL_NOT_FOUND", `Failed to spawn ${command}`, {
          command,
          cause: String(error),
        }),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new BenchError("TOOL_NOT_FOUND", `Failed to read version for ${command}`, {
            command,
            exitCode: code,
          }),
        );
        return;
      }
      const text = (stdout || stderr).trim();
      const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";
      if (firstLine === "") {
        reject(
          new BenchError("TOOL_NOT_FOUND", `Empty version output for ${command}`, { command }),
        );
        return;
      }
      resolve(firstLine);
    });
  });
}

function resolveNodePath(): string {
  const override = process.env["JSBENCH_NODE"];
  if (override !== undefined && override !== "") {
    const resolved = resolveOnPath(override) ?? (isExecutable(override) ? override : undefined);
    if (resolved === undefined) {
      throw new BenchError("TOOL_NOT_FOUND", `JSBENCH_NODE is not executable: ${override}`, {
        path: override,
      });
    }
    return resolved;
  }
  if (isExecutable(process.execPath)) {
    return process.execPath;
  }
  const fromPath = resolveOnPath("node");
  if (fromPath === undefined) {
    throw new BenchError("TOOL_NOT_FOUND", "Node.js binary not found", {});
  }
  return fromPath;
}

function resolveNpmPath(nodePath: string): string | undefined {
  const override = process.env["JSBENCH_NPM"];
  if (override !== undefined && override !== "") {
    return resolveOnPath(override) ?? (isExecutable(override) ? override : undefined);
  }
  const besideNode = join(dirname(nodePath), "npm");
  if (isExecutable(besideNode)) {
    return besideNode;
  }
  return resolveOnPath("npm");
}

function resolveOptionalBinary(envKey: string, commandName: string): string | undefined {
  const override = process.env[envKey];
  if (override !== undefined && override !== "") {
    return resolveOnPath(override) ?? (isExecutable(override) ? override : undefined);
  }
  return resolveOnPath(commandName);
}

/**
 * Discover Node (required) and package managers (optional) for doctor / fingerprints.
 * Honors `JSBENCH_NODE`, `JSBENCH_NPM`, `JSBENCH_PNPM`, `JSBENCH_YARN`.
 */
export async function discoverNativeToolchains(): Promise<ToolchainDiscovery> {
  const nodePath = resolveNodePath();
  const nodeVersion = await readVersion(nodePath, ["--version"]);

  const result: {
    node: { path: string; version: string };
    npm?: { path: string; version: string };
    pnpm?: { path: string; version: string };
    yarn?: { path: string; version: string };
  } = {
    node: { path: nodePath, version: nodeVersion },
  };

  const npmPath = resolveNpmPath(nodePath);
  if (npmPath !== undefined) {
    try {
      result.npm = { path: npmPath, version: await readVersion(npmPath, ["--version"]) };
    } catch {
      // optional
    }
  }

  const pnpmPath = resolveOptionalBinary("JSBENCH_PNPM", "pnpm");
  if (pnpmPath !== undefined) {
    try {
      result.pnpm = { path: pnpmPath, version: await readVersion(pnpmPath, ["--version"]) };
    } catch {
      // optional
    }
  }

  const yarnPath = resolveOptionalBinary("JSBENCH_YARN", "yarn");
  if (yarnPath !== undefined) {
    try {
      result.yarn = { path: yarnPath, version: await readVersion(yarnPath, ["--version"]) };
    } catch {
      // optional
    }
  }

  return result;
}
