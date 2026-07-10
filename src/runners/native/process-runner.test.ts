import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { scrubEnv } from "./env.js";
import { runProcess } from "./process-runner.js";

describe("scrubEnv", () => {
  it("keeps allowlisted keys and drops secrets", () => {
    const scrubbed = scrubEnv({
      PATH: "/usr/bin",
      HOME: "/home/bench",
      USER: "bench",
      SECRET_TOKEN: "nope",
      npm_config_authToken: "hidden",
    });
    assert.equal(scrubbed["PATH"], "/usr/bin");
    assert.equal(scrubbed["HOME"], "/home/bench");
    assert.equal(scrubbed["USER"], "bench");
    assert.equal(scrubbed["SECRET_TOKEN"], undefined);
    assert.equal(scrubbed["npm_config_authToken"], undefined);
  });

  it("includes proxy vars only when requested", () => {
    const source = {
      PATH: "/usr/bin",
      https_proxy: "http://proxy.example:8080",
    };
    assert.equal(scrubEnv(source)["https_proxy"], undefined);
    assert.equal(
      scrubEnv(source, { includeProxies: true })["https_proxy"],
      "http://proxy.example:8080",
    );
  });
});

describe("runProcess", () => {
  it("runs node -e process.exit(0) and records duration", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "jsbench-run-"));
    try {
      const result = await runProcess({
        command: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: logDir,
        timeoutMs: 10_000,
        logDir,
        logPrefix: "ok",
      });
      assert.equal(result.status, "passed");
      assert.equal(result.exitCode, 0);
      assert.equal(result.timedOut, false);
      assert.ok(result.durationMs >= 0);
      assert.ok(result.stdoutPath.endsWith("ok.out.log"));
      assert.ok(result.stderrPath.endsWith("ok.err.log"));
    } finally {
      await rm(logDir, { recursive: true, force: true });
    }
  });

  it("times out a long-running process and marks timeout status", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "jsbench-timeout-"));
    try {
      const result = await runProcess({
        command: process.execPath,
        args: ["-e", "setTimeout(() => {}, 60_000)"],
        cwd: logDir,
        timeoutMs: 200,
        logDir,
        logPrefix: "slow",
      });
      assert.equal(result.status, "timeout");
      assert.equal(result.timedOut, true);
      assert.notEqual(result.exitCode, 0);
      assert.ok(result.durationMs >= 150);
    } finally {
      await rm(logDir, { recursive: true, force: true });
    }
  });

  it("captures stdout to the log file", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "jsbench-out-"));
    try {
      const result = await runProcess({
        command: process.execPath,
        args: ["-e", "process.stdout.write('hello-bench')"],
        cwd: logDir,
        timeoutMs: 10_000,
        logDir,
        logPrefix: "out",
      });
      assert.equal(result.status, "passed");
      const body = await readFile(result.stdoutPath, "utf8");
      assert.equal(body, "hello-bench");
    } finally {
      await rm(logDir, { recursive: true, force: true });
    }
  });
});
