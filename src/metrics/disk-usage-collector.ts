import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Collector, MetricSample, StageContext } from "./types.js";

async function directorySizeBytes(root: string): Promise<number> {
  let total = 0;

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          const info = await stat(full);
          if (info.isFile()) {
            total += info.size;
          }
        }
      } catch {
        // Skip unreadable entries (best-effort).
      }
    }
  }

  await walk(root);
  return total;
}

/**
 * Workspace disk-usage collector (before/after directory size).
 * Emits `workspaceBytesBefore`, `workspaceBytesAfter`, `workspaceBytesDelta`.
 * @see docs/07_METRICS_ENGINE.md §5.3
 */
export class DiskUsageCollector implements Collector {
  readonly id = "disk-usage";
  private beforeBytes: number | undefined;

  async start(ctx: StageContext): Promise<void> {
    try {
      this.beforeBytes = await directorySizeBytes(ctx.workspacePath);
    } catch {
      this.beforeBytes = undefined;
    }
  }

  async stop(ctx: StageContext): Promise<readonly MetricSample[]> {
    if (this.beforeBytes === undefined) {
      return [];
    }
    try {
      const after = await directorySizeBytes(ctx.workspacePath);
      const before = this.beforeBytes;
      this.beforeBytes = undefined;
      return [
        { name: "workspaceBytesBefore", value: before, unit: "bytes" },
        { name: "workspaceBytesAfter", value: after, unit: "bytes" },
        { name: "workspaceBytesDelta", value: after - before, unit: "bytes" },
      ];
    } catch {
      this.beforeBytes = undefined;
      return [];
    }
  }
}

export function createDiskUsageCollector(): Collector {
  return new DiskUsageCollector();
}
