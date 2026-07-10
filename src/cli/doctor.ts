import { ExitCode } from "../errors/bench-error.js";
import type { Logger } from "../logging/logger.js";
import { discoverDocker } from "../runners/docker/discover.js";
import { discoverNativeToolchains } from "../runners/native/discover.js";
import { CLI_VIA_PNPM, MIN_NODE_MAJOR, cliCommand } from "./invocation.js";
import { nodeVersionRequirementDetail } from "./node-version.js";

export type DoctorCheckKind = "required" | "optional";
export type DoctorCheckStatus = "ok" | "missing" | "failed";

export type DoctorCheck = {
  readonly id: string;
  readonly kind: DoctorCheckKind;
  readonly status: DoctorCheckStatus;
  /** @deprecated Prefer `status === "ok"`; kept for older consumers. */
  readonly ok: boolean;
  readonly detail: string;
  readonly fix?: string;
};

export type DoctorResult = {
  readonly ok: boolean;
  readonly exitCode: ExitCode;
  readonly strictDoctor: boolean;
  readonly summary: string;
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
  readonly checks: ReadonlyArray<DoctorCheck>;
};

const PNPM_FIX = [
  "Install pnpm via Corepack (no root required):",
  `  mkdir -p "$HOME/.local/bin"`,
  `  corepack enable --install-directory "$HOME/.local/bin"`,
  `  export PATH="$HOME/.local/bin:$PATH"`,
  "  corepack prepare pnpm@10.12.4 --activate",
  `Then re-run: ${cliCommand("doctor")}`,
].join("\n");

const YARN_FIX = [
  "Install Yarn via Corepack (optional; needed for Yarn matrix cells):",
  `  mkdir -p "$HOME/.local/bin"`,
  `  corepack enable --install-directory "$HOME/.local/bin"`,
  `  export PATH="$HOME/.local/bin:$PATH"`,
  "  corepack prepare yarn@stable --activate",
].join("\n");

const NPM_FIX =
  "npm usually ships with Node.js. Reinstall Node.js from https://nodejs.org/ or your distro, then ensure `npm` is on PATH.";

const DOCKER_FIX = [
  "Install Docker Engine, ensure the `docker` CLI is on PATH, and that the daemon is running",
  "(`docker info`). Required only for Docker profiles (e.g. docker-smoke).",
].join(" ");

function checkFromTool(options: {
  readonly id: string;
  readonly kind: DoctorCheckKind;
  readonly tool: { readonly path: string; readonly version: string } | undefined;
  readonly missingDetail: string;
  readonly fix: string;
}): DoctorCheck {
  if (options.tool !== undefined) {
    return {
      id: options.id,
      kind: options.kind,
      status: "ok",
      ok: true,
      detail: `${options.tool.version} at ${options.tool.path}`,
    };
  }
  return {
    id: options.id,
    kind: options.kind,
    status: "missing",
    ok: false,
    detail: options.missingDetail,
    fix: options.fix,
  };
}

/**
 * Format a human-readable doctor report for first-time users.
 */
export function formatDoctorHuman(result: DoctorResult): string {
  const lines: string[] = [
    "jsbench doctor",
    "",
    result.ok
      ? "Status: OK — required prerequisites are satisfied."
      : "Status: FAILED — fix required items below before running benchmarks.",
    "",
    "Required",
    "--------",
  ];

  for (const check of result.checks.filter((c) => c.kind === "required")) {
    lines.push(formatCheckLine(check));
    if (check.fix !== undefined && check.status !== "ok") {
      for (const fixLine of check.fix.split("\n")) {
        lines.push(`    ${fixLine}`);
      }
    }
  }

  lines.push("", "Optional", "--------");
  for (const check of result.checks.filter((c) => c.kind === "optional")) {
    lines.push(formatCheckLine(check));
    if (check.fix !== undefined && check.status !== "ok") {
      for (const fixLine of check.fix.split("\n")) {
        lines.push(`    ${fixLine}`);
      }
    }
  }

  lines.push(
    "",
    "Next steps",
    "----------",
    `  ${cliCommand("list-profiles")}`,
    `  ${cliCommand("run --profile native-smoke")}`,
    "",
    `Tip: use \`${CLI_VIA_PNPM} …\` from a clone (or \`node dist/cli.js …\` after pnpm build).`,
    `Machine-readable output: ${cliCommand("doctor --json")}`,
  );

  return `${lines.join("\n")}\n`;
}

function formatCheckLine(check: DoctorCheck): string {
  const mark = check.status === "ok" ? "[ok]" : check.status === "missing" ? "[missing]" : "[fail]";
  return `  ${mark} ${check.id}: ${check.detail}`;
}

/**
 * Prerequisite checks (Node >= 20 required; package managers and Docker optional).
 */
export async function runDoctor(options: {
  readonly logger: Logger;
  readonly strictDoctor: boolean;
}): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];

  try {
    const toolchains = await discoverNativeToolchains();
    const nodeReq = nodeVersionRequirementDetail(toolchains.node.version);
    checks.push({
      id: "node",
      kind: "required",
      status: nodeReq.ok ? "ok" : "failed",
      ok: nodeReq.ok,
      detail: `${nodeReq.detail} at ${toolchains.node.path}`,
      ...(nodeReq.fix !== undefined ? { fix: nodeReq.fix } : {}),
    });

    checks.push(
      checkFromTool({
        id: "npm",
        kind: "optional",
        tool: toolchains.npm,
        missingDetail: "npm not found (needed for npm matrix cells / install-build-matrix)",
        fix: NPM_FIX,
      }),
      checkFromTool({
        id: "pnpm",
        kind: "optional",
        tool: toolchains.pnpm,
        missingDetail:
          "pnpm not found on PATH (needed for most official profiles and this repo's packageManager)",
        fix: PNPM_FIX,
      }),
      checkFromTool({
        id: "yarn",
        kind: "optional",
        tool: toolchains.yarn,
        missingDetail: "yarn not found (optional; only for Yarn matrix cells / *-benchmark-slow)",
        fix: YARN_FIX,
      }),
    );

    const docker = await discoverDocker();
    checks.push({
      id: "docker",
      kind: "optional",
      status: docker.available ? "ok" : "missing",
      ok: docker.available,
      detail: docker.detail,
      ...(docker.available ? {} : { fix: DOCKER_FIX }),
    });

    const requiredFailed = checks.some((c) => c.kind === "required" && !c.ok);
    const ok = !requiredFailed;
    const exitCode = ok ? ExitCode.Success : ExitCode.DoctorFailure;
    const missingOptional = checks.filter((c) => c.kind === "optional" && !c.ok).map((c) => c.id);

    const summary = ok
      ? missingOptional.length === 0
        ? `All checks passed (Node >= ${MIN_NODE_MAJOR}, package managers, Docker).`
        : `Required OK. Missing optional: ${missingOptional.join(", ")}.`
      : "Required checks failed — see checks[].fix for remediation.";

    options.logger.info("Doctor checks complete", {
      ok,
      node: toolchains.node.version,
      npm: toolchains.npm?.version,
      pnpm: toolchains.pnpm?.version,
      yarn: toolchains.yarn?.version,
      docker: docker.available ? docker.version : undefined,
      missingOptional,
    });

    const result: DoctorResult = {
      ok,
      exitCode,
      summary,
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
    return result;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    checks.push({
      id: "node",
      kind: "required",
      status: "failed",
      ok: false,
      detail,
      fix: `Install Node.js ${MIN_NODE_MAJOR}+ and ensure it is on PATH. See README “First-time setup (Linux)”.`,
    });
    options.logger.error("Doctor failed", { detail });
    const result: DoctorResult = {
      ok: false,
      exitCode: ExitCode.DoctorFailure,
      summary: "Required checks failed — Node.js could not be discovered.",
      strictDoctor: options.strictDoctor,
      toolchains: {
        node: { path: "", version: "" },
      },
      checks,
    };
    return result;
  }
}
