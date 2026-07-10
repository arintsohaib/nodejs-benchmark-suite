import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { listRelativeFiles } from "./list-files.js";
import { materialize } from "./materialize.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

type CalibratedDigests = {
  readonly templates: Readonly<Record<string, string>>;
};

const FILE_INVENTORY = {
  "node-ts-lib": [
    "package.json",
    "src/generated/index.ts",
    "src/generated/m000.ts",
    "src/generated/m001.ts",
    "src/index.ts",
    "src/lib/util.ts",
    "tsconfig.json",
  ],
  "nextjs-app": [
    "app/gen/p000/page.tsx",
    "app/gen/p001/page.tsx",
    "app/globals.css",
    "app/layout.tsx",
    "app/page.tsx",
    "next-env.d.ts",
    "next.config.mjs",
    "package.json",
    "tsconfig.json",
  ],
} as const;

describe("S11 template tiny snapshots", () => {
  for (const templateId of ["node-ts-lib", "nextjs-app"] as const) {
    it(`materializes ${templateId} tiny with stable digest and file inventory`, async () => {
      const calibration = JSON.parse(
        await readFile(join(ROOT, "profiles", "calibrated-digests.json"), "utf8"),
      ) as CalibratedDigests;
      const expectedDigest = calibration.templates[`${templateId}@tiny@1`];
      assert.ok(expectedDigest, `missing calibrated digest for ${templateId}`);

      const root = await mkdtemp(join(tmpdir(), `jsbench-${templateId}-`));
      try {
        const workspacePath = join(root, "ws");
        const ref = await materialize({
          workload: { template: templateId, size: "tiny", seed: 1 },
          workspacePath,
          createdAt: "2026-07-11T00:00:00.000Z",
        });

        const files = (await listRelativeFiles(workspacePath)).filter(
          (f) => f !== ".jsbench-workspace.json",
        );
        assert.deepEqual(files, [...FILE_INVENTORY[templateId]]);
        assert.equal(ref.contentDigest, expectedDigest);

        const pkg = JSON.parse(await readFile(join(workspacePath, "package.json"), "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const [name, spec] of Object.entries(allDeps)) {
          assert.ok(!spec.startsWith("policy:"), `${name} should be pinned, got ${spec}`);
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});
