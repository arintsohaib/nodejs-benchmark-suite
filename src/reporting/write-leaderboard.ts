import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { BenchError } from "../errors/bench-error.js";
import {
  type LeaderboardDocument,
  buildLeaderboard,
  renderLeaderboardMarkdown,
} from "./leaderboard.js";
import { loadRunArtifact } from "./load-run-artifact.js";
import type { RunArtifact } from "./types.js";
import { assertValidLeaderboard } from "./validate-leaderboard.js";

export type DiscoveredRun = {
  readonly artifact: RunArtifact;
  readonly sourcePath: string;
};

/**
 * Recursively find directories (or files) containing `run.json` under a reports root.
 * Depth is bounded to avoid walking huge trees.
 */
export async function discoverRunArtifacts(
  rootDir: string,
  options: { readonly maxDepth?: number } = {},
): Promise<readonly DiscoveredRun[]> {
  const maxDepth = options.maxDepth ?? 4;
  const root = resolve(rootDir);
  const found: DiscoveredRun[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error) {
      throw new BenchError("IO_ERROR", `Cannot read directory: ${dir}`, {
        path: dir,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    if (names.includes("run.json")) {
      const runJsonPath = join(dir, "run.json");
      const artifact = await loadRunArtifact(runJsonPath);
      found.push({
        artifact,
        sourcePath: relative(root, runJsonPath) || "run.json",
      });
      return;
    }

    for (const name of names.sort()) {
      if (name.startsWith(".")) {
        continue;
      }
      const child = join(dir, name);
      let info: Awaited<ReturnType<typeof stat>>;
      try {
        info = await stat(child);
      } catch {
        continue;
      }
      if (info.isDirectory()) {
        await walk(child, depth + 1);
      }
    }
  }

  const rootInfo = await stat(root).catch((error: unknown) => {
    throw new BenchError("INVALID_CONFIG", `Cannot read --from path: ${root}`, {
      path: root,
      cause: error instanceof Error ? error.message : String(error),
    });
  });

  if (rootInfo.isFile()) {
    const artifact = await loadRunArtifact(root);
    found.push({ artifact, sourcePath: relative(process.cwd(), root) || root });
    return found;
  }

  await walk(root, 0);
  return found;
}

export type WriteLeaderboardResult = {
  readonly outDir: string;
  readonly jsonPath: string;
  readonly mdPath: string;
};

export async function writeLeaderboard(
  doc: LeaderboardDocument,
  outDir: string,
): Promise<WriteLeaderboardResult> {
  assertValidLeaderboard(doc);
  const resolved = resolve(outDir);
  await mkdir(resolved, { recursive: true });
  const jsonPath = join(resolved, "leaderboard.json");
  const mdPath = join(resolved, "leaderboard.md");
  await writeFile(jsonPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderLeaderboardMarkdown(doc), "utf8");
  return { outDir: resolved, jsonPath, mdPath };
}

export async function buildLeaderboardFromReports(
  fromPath: string,
  options: {
    readonly suiteVersion: string;
    readonly metricFilter?: string;
    readonly createdAt?: string;
  },
): Promise<LeaderboardDocument> {
  const discovered = await discoverRunArtifacts(fromPath);
  return buildLeaderboard(discovered, {
    suiteVersion: options.suiteVersion,
    ...(options.metricFilter !== undefined ? { metricFilter: options.metricFilter } : {}),
    ...(options.createdAt !== undefined ? { createdAt: options.createdAt } : {}),
  });
}
