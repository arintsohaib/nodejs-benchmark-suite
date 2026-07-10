import { readFile } from "node:fs/promises";

/**
 * Read the end of a stage log for CLI warnings (best-effort; never throws).
 */
export async function readLogTail(
  path: string | undefined,
  maxChars = 600,
): Promise<string | undefined> {
  if (path === undefined || path === "") {
    return undefined;
  }
  try {
    const text = await readFile(path, "utf8");
    const trimmed = text.trimEnd();
    if (trimmed === "") {
      return undefined;
    }
    if (trimmed.length <= maxChars) {
      return trimmed;
    }
    return `…[tail]…\n${trimmed.slice(-maxChars)}`;
  } catch {
    return undefined;
  }
}
