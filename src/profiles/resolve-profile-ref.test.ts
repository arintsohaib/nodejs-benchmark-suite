import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { BenchError } from "../errors/bench-error.js";
import { resolveProfileRef } from "./resolve-profile-ref.js";

describe("resolveProfileRef", () => {
  it("resolves an explicit file path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsbench-pref-"));
    const file = join(dir, "custom.yaml");
    await writeFile(file, "id: custom\n", "utf8");
    const resolved = await resolveProfileRef(file, { profilesDir: join(dir, "profiles") });
    assert.equal(resolved, file);
  });

  it("resolves a profile id under profilesDir", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-pid-"));
    const profilesDir = join(root, "profiles");
    await mkdir(profilesDir, { recursive: true });
    const file = join(profilesDir, "native-smoke.yaml");
    await writeFile(file, "id: native-smoke\n", "utf8");
    const resolved = await resolveProfileRef("native-smoke", {
      cwd: root,
      profilesDir: "./profiles",
    });
    assert.equal(resolved, file);
  });

  it("fails when neither path nor id exists", async () => {
    await assert.rejects(
      () =>
        resolveProfileRef("missing-profile", {
          profilesDir: join(tmpdir(), "no-such-profiles-dir"),
        }),
      (error: unknown) => {
        assert.ok(error instanceof BenchError);
        assert.equal(error.code, "PROFILE_NOT_FOUND");
        return true;
      },
    );
  });
});
