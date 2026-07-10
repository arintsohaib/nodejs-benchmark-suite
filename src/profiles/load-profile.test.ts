import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { BenchError } from "../errors/bench-error.js";
import { digestValue } from "./digest.js";
import { loadProfile } from "./load-profile.js";

const VALID_PROFILE = `
schemaVersion: 1
id: foundation-sample
description: Scaffold-only sample profile
workload:
  template: node-ts-lib
  size: tiny
  seed: 1
stages:
  - id: noop
    action: project.build
iterations:
  warmup: 0
  measured: 1
runner:
  type: native
metrics:
  collectors: [wall]
reporting:
  formats: [json, markdown]
`;

const IQR_PROFILE = `
schemaVersion: 1
id: iqr-sample
workload:
  template: node-ts-lib
  size: tiny
  seed: 1
stages:
  - id: noop
    action: project.build
iterations:
  measured: 5
runner:
  type: native
metrics:
  collectors: [wall]
  outlierRule: iqr
`;

describe("digestValue", () => {
  it("is stable regardless of key insertion order", () => {
    const a = digestValue({ b: 1, a: 2 });
    const b = digestValue({ a: 2, b: 1 });
    assert.equal(a, b);
  });
});

describe("loadProfile", () => {
  it("loads and validates a YAML profile", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsbench-profile-"));
    const path = join(dir, "sample.yaml");
    await writeFile(path, VALID_PROFILE, "utf8");

    const loaded = await loadProfile(path);
    assert.equal(loaded.profile.id, "foundation-sample");
    assert.equal(loaded.profile.schemaVersion, 1);
    assert.match(loaded.digest, /^[a-f0-9]{64}$/);
  });

  it("accepts metrics.outlierRule iqr", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsbench-profile-iqr-"));
    const path = join(dir, "iqr.yaml");
    await writeFile(path, IQR_PROFILE, "utf8");
    const loaded = await loadProfile(path);
    assert.equal(loaded.profile.metrics?.outlierRule, "iqr");
  });

  it("rejects invalid profiles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsbench-profile-bad-"));
    const path = join(dir, "bad.yaml");
    await writeFile(path, "schemaVersion: 1\nid: bad\n", "utf8");

    await assert.rejects(
      () => loadProfile(path),
      (error: unknown) => {
        assert.ok(error instanceof BenchError);
        assert.equal(error.code, "INVALID_PROFILE");
        return true;
      },
    );
  });
});
