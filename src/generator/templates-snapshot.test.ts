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
  "nextjs-app-tailwind": [
    "app/gen/p000/page.tsx",
    "app/gen/p001/page.tsx",
    "app/globals.css",
    "app/layout.tsx",
    "app/page.tsx",
    "next-env.d.ts",
    "next.config.mjs",
    "package.json",
    "postcss.config.mjs",
    "tsconfig.json",
  ],
  "pnpm-workspace": [
    "package.json",
    "packages/pkg-000/package.json",
    "packages/pkg-000/src/generated/index.ts",
    "packages/pkg-000/src/generated/m000.ts",
    "packages/pkg-000/src/generated/m001.ts",
    "packages/pkg-000/src/index.ts",
    "packages/pkg-000/tsconfig.json",
    "packages/pkg-001/package.json",
    "packages/pkg-001/src/generated/index.ts",
    "packages/pkg-001/src/generated/m000.ts",
    "packages/pkg-001/src/generated/m001.ts",
    "packages/pkg-001/src/index.ts",
    "packages/pkg-001/tsconfig.json",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
  ],
} as const;

describe("template tiny snapshots", () => {
  for (const templateId of [
    "node-ts-lib",
    "nextjs-app",
    "nextjs-app-tailwind",
    "pnpm-workspace",
  ] as const) {
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

        if (templateId === "pnpm-workspace") {
          const child = JSON.parse(
            await readFile(join(workspacePath, "packages/pkg-001/package.json"), "utf8"),
          ) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          assert.equal(child.dependencies?.["@jsbench/pkg-000"], "workspace:*");
          for (const [name, spec] of Object.entries({
            ...child.dependencies,
            ...child.devDependencies,
          })) {
            if (spec === "workspace:*") {
              continue;
            }
            assert.ok(!spec.startsWith("policy:"), `child ${name} should be pinned, got ${spec}`);
          }
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});
