import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cellCacheRoot, npmCacheEnv, pnpmCacheEnv, yarnCacheEnv } from "./cache-dirs.js";
import {
  createNpmAdapter,
  createPnpmAdapter,
  createYarnAdapter,
  resolvePackageManagerAction,
} from "./index.js";

describe("package-manager adapters argv", () => {
  const cacheDir = "/tmp/jsbench-cache-cell";
  const prev = {
    npm: process.env["JSBENCH_NPM"],
    pnpm: process.env["JSBENCH_PNPM"],
    yarn: process.env["JSBENCH_YARN"],
  };

  before(() => {
    // Use Node as a stand-in executable so argv tests do not require real PMs.
    process.env["JSBENCH_NPM"] = process.execPath;
    process.env["JSBENCH_PNPM"] = process.execPath;
    process.env["JSBENCH_YARN"] = process.execPath;
  });

  after(() => {
    for (const [key, value] of [
      ["JSBENCH_NPM", prev.npm],
      ["JSBENCH_PNPM", prev.pnpm],
      ["JSBENCH_YARN", prev.yarn],
    ] as const) {
      if (value === undefined) {
        process.env[key] = undefined;
      } else {
        process.env[key] = value;
      }
    }
  });

  it("maps npm install/build/typecheck/test", () => {
    const npm = createNpmAdapter();
    assert.deepEqual(npm.resolve("packageManager.install", cacheDir).args, ["install"]);
    assert.deepEqual(npm.resolve("project.build", cacheDir).args, ["run", "build"]);
    assert.deepEqual(npm.resolve("project.typecheck", cacheDir).args, ["run", "typecheck"]);
    assert.deepEqual(npm.resolve("project.test", cacheDir).args, ["test"]);
    assert.equal(
      npm.resolve("packageManager.install", cacheDir).extraEnv["npm_config_cache"],
      npmCacheEnv(cacheDir)["npm_config_cache"],
    );
  });

  it("maps pnpm install/build", () => {
    const pnpm = createPnpmAdapter();
    assert.deepEqual(pnpm.resolve("packageManager.install", cacheDir).args, ["install"]);
    assert.deepEqual(pnpm.resolve("project.build", cacheDir).args, ["run", "build"]);
    assert.equal(
      pnpm.resolve("packageManager.install", cacheDir).extraEnv["PNPM_STORE_DIR"],
      pnpmCacheEnv(cacheDir)["PNPM_STORE_DIR"],
    );
  });

  it("maps yarn Berry install/build (no run prefix)", () => {
    const yarn = createYarnAdapter();
    assert.deepEqual(yarn.resolve("packageManager.install", cacheDir).args, ["install"]);
    assert.deepEqual(yarn.resolve("project.build", cacheDir).args, ["build"]);
    assert.deepEqual(yarn.resolve("project.typecheck", cacheDir).args, ["typecheck"]);
    assert.equal(
      yarn.resolve("packageManager.install", cacheDir).extraEnv["YARN_CACHE_FOLDER"],
      yarnCacheEnv(cacheDir)["YARN_CACHE_FOLDER"],
    );
    assert.equal(
      yarn.resolve("packageManager.install", cacheDir).extraEnv["YARN_NODE_LINKER"],
      "node-modules",
    );
  });

  it("resolvePackageManagerAction rejects unknown pm", () => {
    assert.throws(
      () =>
        resolvePackageManagerAction({
          packageManager: "bun",
          action: "project.build",
          cacheDir,
        }),
      /Unsupported packageManager/,
    );
  });

  it("builds cell cache roots under run _caches", () => {
    assert.equal(
      cellCacheRoot({ workspaceRoot: "/w", runId: "r1", cellId: "packagemanager-npm" }),
      "/w/r1/_caches/packagemanager-npm",
    );
  });
});
