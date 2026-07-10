import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadProfile } from "../profiles/load-profile.js";

export type ProfileListItem = {
  readonly id: string;
  readonly path: string;
  readonly description?: string;
  readonly digest: string;
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
      });
    } catch {
      // Skip unreadable / invalid files so one bad doc does not block listing.
    }
  }

  return items.sort((a, b) => a.id.localeCompare(b.id));
}
