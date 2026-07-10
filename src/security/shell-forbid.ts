import { readFile, readdir, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { BenchError } from "../errors/bench-error.js";

const SHELL_TRUE = /\bshell\s*:\s*true\b/;
const SHELL_FALSE = /\bshell\s*:\s*false\b/;

/** Spawn entrypoints that must explicitly set `shell: false`. */
export const REQUIRED_SHELL_FALSE_FILES = [
  "runners/native/process-runner.ts",
  "runners/docker/cli.ts",
] as const;

/**
 * Reject profile actions that imply shell string execution.
 * Unsafe shell mode is intentionally unsupported in v1.
 */
export function assertNoShellAction(action: string, stageId?: string): void {
  const normalized = action.trim().toLowerCase();
  if (
    normalized === "shell" ||
    normalized === "unsafe.shell" ||
    normalized.startsWith("shell.") ||
    normalized.startsWith("unsafe.shell")
  ) {
    throw new BenchError(
      "INVALID_PROFILE",
      `Shell actions are forbidden (got "${action}"). Use argv-based actions such as raw.command.`,
      { action, ...(stageId !== undefined ? { stageId } : {}) },
    );
  }
}

/** True when source text enables Node `shell: true` spawning. */
export function sourceEnablesShellTrue(source: string): boolean {
  return SHELL_TRUE.test(source);
}

/** True when source text explicitly disables shell spawning. */
export function sourceDisablesShell(source: string): boolean {
  return SHELL_FALSE.test(source);
}

async function listTsFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") {
          continue;
        }
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

export type ShellForbidAuditResult = {
  readonly scannedFiles: number;
  readonly offenders: readonly string[];
  readonly missingShellFalse: readonly string[];
};

/**
 * Audit `src/` for `shell: true` and require known spawn sites to set `shell: false`.
 */
export async function auditShellForbid(srcRoot: string): Promise<ShellForbidAuditResult> {
  const files = await listTsFiles(srcRoot);
  const offenders: string[] = [];
  for (const file of files) {
    if (file.endsWith(".test.ts") || file.endsWith(`${sep}shell-forbid.ts`)) {
      // Tests and this module mention the forbidden pattern by design.
      continue;
    }
    const source = await readFile(file, "utf8");
    if (sourceEnablesShellTrue(source)) {
      offenders.push(file);
    }
  }

  const missingShellFalse: string[] = [];
  for (const rel of REQUIRED_SHELL_FALSE_FILES) {
    const full = join(srcRoot, rel);
    try {
      await stat(full);
    } catch {
      missingShellFalse.push(full);
      continue;
    }
    const source = await readFile(full, "utf8");
    if (!sourceDisablesShell(source)) {
      missingShellFalse.push(full);
    }
  }

  return {
    scannedFiles: files.length,
    offenders,
    missingShellFalse,
  };
}
