import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadProfile } from "../profiles/load-profile.js";
import { type ProfileTier, formatProfileTierLabel, inferProfileTier } from "../reporting/format.js";
import { cliCommand } from "./invocation.js";

export type ProfileListItem = {
  readonly id: string;
  readonly path: string;
  readonly description?: string;
  readonly digest: string;
  readonly tier: ProfileTier;
};

const PROFILE_EXT = /\.(ya?ml|json)$/i;

/**
 * List loadable profiles under `profilesDir` (sorted by id).
 */
export async function listProfiles(profilesDir: string): Promise<readonly ProfileListItem[]> {
  const names = await readdir(profilesDir);

  const items: ProfileListItem[] = [];
  for (const name of names.sort()) {
    if (!PROFILE_EXT.test(name)) {
      continue;
    }
    if (name === "calibrated-digests.json") {
      continue;
    }
    const path = join(profilesDir, name);
    try {
      const loaded = await loadProfile(path);
      items.push({
        id: loaded.profile.id,
        path: loaded.path,
        ...(loaded.profile.description !== undefined
          ? { description: loaded.profile.description.trim() }
          : {}),
        digest: loaded.digest,
        tier: inferProfileTier(loaded.profile.id),
      });
    } catch {
      // Skip unreadable / invalid files so one bad doc does not block listing.
    }
  }

  return items.sort((a, b) => a.id.localeCompare(b.id));
}

/** Human-readable profile catalog for first-time users. */
export function formatProfileListHuman(items: readonly ProfileListItem[]): string {
  const idWidth = Math.max(16, ...items.map((i) => i.id.length));
  const tierWidth = Math.max(14, ...items.map((i) => formatProfileTierLabel(i.tier).length));
  const lines = [
    "Built-in profiles",
    "",
    `${"ID".padEnd(idWidth)}  ${"TIER".padEnd(tierWidth)}  DIGEST`,
    `${"-".repeat(idWidth)}  ${"-".repeat(tierWidth)}  ${"-".repeat(16)}`,
  ];
  for (const item of items) {
    const tier = formatProfileTierLabel(item.tier);
    const digestShort = `${item.digest.slice(0, 12)}…`;
    lines.push(`${item.id.padEnd(idWidth)}  ${tier.padEnd(tierWidth)}  ${digestShort}`);
  }
  lines.push(
    "",
    "Smoke profiles are the fastest first run. Example:",
    `  ${cliCommand("run --profile native-smoke")}`,
    "",
    `JSON: ${cliCommand("list-profiles --json")}`,
    "",
  );
  return lines.join("\n");
}
