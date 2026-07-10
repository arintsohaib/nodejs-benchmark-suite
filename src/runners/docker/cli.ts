import { spawn } from "node:child_process";
import { BenchError } from "../../errors/bench-error.js";
import { resolveOnPath } from "../native/discover.js";
import type { DockerCli, DockerCliResult } from "./types.js";

function resolveDockerBinary(): string {
  const override = process.env["JSBENCH_DOCKER"];
  if (override !== undefined && override !== "") {
    return resolveOnPath(override) ?? override;
  }
  const fromPath = resolveOnPath("docker");
  if (fromPath === undefined) {
    throw new BenchError("DOCKER_ERROR", "docker CLI not found on PATH (set JSBENCH_DOCKER)", {});
  }
  return fromPath;
}

/**
 * Default Docker CLI adapter (argv spawn, no shell).
 */
export function createDockerCli(dockerPath: string = resolveDockerBinary()): DockerCli {
  return {
    exec(args, options = {}) {
      const timeoutMs = options.timeoutMs ?? 120_000;
      return new Promise<DockerCliResult>((resolve, reject) => {
        const child = spawn(dockerPath, [...args], {
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
          shell: false,
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
            new BenchError(
              "DOCKER_ERROR",
              `docker ${args[0] ?? ""} timed out after ${timeoutMs}ms`,
              {
                args,
                timeoutMs,
              },
            ),
          );
        }, timeoutMs);
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(
            new BenchError(
              "DOCKER_ERROR",
              `Failed to spawn docker: ${error.message}`,
              { args },
              { cause: error },
            ),
          );
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({
            exitCode: code ?? 1,
            stdout,
            stderr,
          });
        });
      });
    },
  };
}

export async function dockerVersion(cli: DockerCli): Promise<string> {
  const result = await cli.exec(["version", "--format", "{{.Server.Version}}"], {
    timeoutMs: 15_000,
  });
  if (result.exitCode !== 0) {
    throw new BenchError("DOCKER_ERROR", "Unable to query Docker daemon version", {
      stderr: result.stderr.trim(),
      exitCode: result.exitCode,
    });
  }
  const version = result.stdout.trim();
  if (version === "") {
    throw new BenchError("DOCKER_ERROR", "Empty Docker server version", {});
  }
  return version;
}

export async function assertDockerDaemon(cli: DockerCli): Promise<string> {
  const info = await cli.exec(["info", "--format", "{{.ServerVersion}}"], { timeoutMs: 15_000 });
  if (info.exitCode !== 0) {
    throw new BenchError("DOCKER_ERROR", "Docker daemon unreachable (is the engine running?)", {
      stderr: info.stderr.trim(),
      exitCode: info.exitCode,
    });
  }
  return info.stdout.trim() || (await dockerVersion(cli));
}
