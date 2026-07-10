import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const EXCLUDED_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  "coverage",
  "dist",
  ".turbo",
  ".cache",
]);

const EXCLUDED_FILE_NAMES = new Set([".ds_store", "thumbs.db", ".jsbench-workspace.json"]);

function shouldSkipDir(name: string): boolean {
  return EXCLUDED_DIR_NAMES.has(name);
}

function shouldSkipFile(name: string): boolean {
  const lower = name.toLowerCase();
  if (EXCLUDED_FILE_NAMES.has(lower)) {
    return true;
  }
  return lower.endsWith(".log");
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) {
          continue;
        }
        await walk(join(dir, entry.name));
        continue;
      }
      if (entry.isFile()) {
        if (shouldSkipFile(entry.name)) {
          continue;
        }
        out.push(join(dir, entry.name));
      }
    }
  }

  await walk(root);
  return out;
}

function toPosixRel(root: string, absolutePath: string): string {
  const rel = relative(root, absolutePath);
  return rel.split(sep).join("/");
}

/**
 * Content digest of a workspace tree (SHA-256 hex).
 * Paths sorted POSIX-style; newlines normalized to `\n`.
 * Excludes volatile dirs/files per docs/04_GENERATOR_ENGINE.md §8.
 */
export async function digestWorkspace(workspacePath: string): Promise<string> {
  const files = await listFilesRecursive(workspacePath);
  files.sort((a, b) => toPosixRel(workspacePath, a).localeCompare(toPosixRel(workspacePath, b)));

  const hash = createHash("sha256");
  for (const filePath of files) {
    const rel = toPosixRel(workspacePath, filePath);
    const raw = await readFile(filePath);
    const text = raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    hash.update(rel);
    hash.update("\0");
    hash.update(text);
    hash.update("\n");
  }
  return hash.digest("hex");
}

/** Test helper: ensure a path exists and is a directory. */
export async function assertDirectory(path: string): Promise<void> {
  const info = await stat(path);
  if (!info.isDirectory()) {
    throw new Error(`Not a directory: ${path}`);
  }
}

export const DIGEST_EXCLUDED_DIRS = [...EXCLUDED_DIR_NAMES] as const;
