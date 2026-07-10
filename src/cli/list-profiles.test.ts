import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { listProfiles } from "./list-profiles.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("listProfiles", () => {
  it("lists built-in profiles including install-build-matrix and docker-smoke", async () => {
    const items = await listProfiles(join(REPO_ROOT, "profiles"));
    const ids = items.map((p) => p.id);
    assert.ok(ids.includes("native-smoke"));
    assert.ok(ids.includes("install-build-matrix"));
    assert.ok(ids.includes("docker-smoke"));
    assert.ok(ids.includes("foundation-sample"));
    for (const item of items) {
      assert.match(item.digest, /^[a-f0-9]{64}$/);
      assert.ok(item.path.length > 0);
    }
  });
});
