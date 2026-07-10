import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { listProfiles } from "../cli/list-profiles.js";
import { createRunPlan } from "../engine/plan.js";
import { loadProfile } from "./load-profile.js";
import { resolveProfileRef } from "./resolve-profile-ref.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROFILES_DIR = join(ROOT, "profiles");

type CalibratedDigests = {
  readonly profiles: Readonly<Record<string, string>>;
  readonly templates: Readonly<Record<string, string>>;
};

async function loadCalibration(): Promise<CalibratedDigests> {
  const raw = await readFile(join(PROFILES_DIR, "calibrated-digests.json"), "utf8");
  return JSON.parse(raw) as CalibratedDigests;
}

/** Official publishable / catalog profile ids (excludes foundation-sample helper). */
const OFFICIAL_PROFILE_IDS = [
  "native-smoke",
  "docker-smoke",
  "install-build-matrix",
  "nextjs-app-smoke",
  "nextjs-app-benchmark",
  "nextjs-app-benchmark-slow",
  "nextjs-app-tailwind-smoke",
  "nextjs-app-tailwind-benchmark",
  "nextjs-app-tailwind-benchmark-slow",
  "pnpm-workspace-smoke",
  "pnpm-workspace-benchmark",
  "pnpm-workspace-benchmark-slow",
] as const;

describe("built-in profile calibration (S17)", () => {
  it("lists expected built-in profiles", async () => {
    const items = await listProfiles(PROFILES_DIR);
    const ids = items.map((item) => item.id);
    for (const id of OFFICIAL_PROFILE_IDS) {
      assert.ok(ids.includes(id), `missing profile ${id}`);
    }
    assert.ok(ids.includes("foundation-sample"));
  });

  it("matches calibrated profile digests", async () => {
    const calibration = await loadCalibration();
    const items = await listProfiles(PROFILES_DIR);
    for (const item of items) {
      const expected = calibration.profiles[item.id];
      assert.ok(expected !== undefined, `no calibrated digest for ${item.id}`);
      assert.equal(item.digest, expected, `digest drift for ${item.id}`);
    }
  });

  it("dry-runs a RunPlan for every built-in profile", async () => {
    const items = await listProfiles(PROFILES_DIR);
    for (const item of items) {
      const path = await resolveProfileRef(item.id, { profilesDir: PROFILES_DIR });
      const loaded = await loadProfile(path);
      const plan = createRunPlan({
        profile: loaded.profile,
        profileDigest: loaded.digest,
      });
      assert.equal(plan.profile.id, item.id);
      assert.ok(plan.cells.length >= 1, `${item.id} should have ≥1 cell`);
      assert.ok(plan.stages.length >= 1, `${item.id} should have ≥1 stage`);
      assert.ok(plan.iterations >= 1);
    }
  });
});
