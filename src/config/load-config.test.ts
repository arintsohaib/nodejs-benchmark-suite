import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { BenchError } from "../errors/bench-error.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { loadConfig } from "./load-config.js";
import { mergeConfig } from "./merge.js";
import { redactEnvVars } from "./redact.js";

describe("mergeConfig", () => {
  it("applies later layers over earlier ones", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { logLevel: "debug" }, { outputDir: "/tmp/out" });
    assert.equal(merged.logLevel, "debug");
    assert.equal(merged.outputDir, "/tmp/out");
    assert.equal(merged.defaultRunner, "native");
  });
});

describe("redactEnvVars", () => {
  it("redacts sensitive keys and keeps others", () => {
    const redacted = redactEnvVars(
      {
        PATH: "/usr/bin",
        OPENROUTER_API_KEY: "secret",
        MY_TOKEN: "x",
        SAFE: "ok",
      },
      DEFAULT_CONFIG.redactEnv,
    );
    assert.equal(redacted["PATH"], "/usr/bin");
    assert.equal(redacted["SAFE"], "ok");
    assert.equal(redacted["OPENROUTER_API_KEY"], "[REDACTED]");
    assert.equal(redacted["MY_TOKEN"], "[REDACTED]");
  });
});

describe("loadConfig", () => {
  it("loads project yaml and applies env over file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsbench-config-"));
    await writeFile(
      join(dir, "jsbench.config.yaml"),
      ["outputDir: ./custom-reports", "logLevel: warn", "strictDoctor: false"].join("\n"),
      "utf8",
    );

    const config = await loadConfig({
      cwd: dir,
      env: {
        ...process.env,
        JSBENCH_LOG_LEVEL: "debug",
      },
    });

    assert.equal(config.logLevel, "debug");
    assert.equal(config.strictDoctor, false);
    assert.ok(config.outputDir.endsWith("custom-reports"));
  });

  it("fails when an explicit config path is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsbench-config-missing-"));
    await assert.rejects(
      () =>
        loadConfig({
          cwd: dir,
          configPath: join(dir, "does-not-exist.yaml"),
          env: { ...process.env },
        }),
      (error: unknown) => {
        assert.ok(error instanceof BenchError);
        assert.equal(error.code, "INVALID_CONFIG");
        return true;
      },
    );
  });
});
