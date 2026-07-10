import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli.js";
import { ExitCode } from "../errors/bench-error.js";
import { resolveStageCommand } from "./resolve-action.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "fixtures", "cli-mvp-fixture.yaml");
const FAIL_FIXTURE = join(HERE, "fixtures", "cli-mvp-fail-fixture.yaml");

describe("resolveStageCommand", () => {
  it("maps node to process.execPath for raw.command", () => {
    const resolved = resolveStageCommand({
      stage: {
        id: "noop",
        action: "raw.command",
        command: "node",
        args: ["-e", "process.exit(0)"],
      },
      cell: { cellId: "default", axes: {} },
      cacheDir: "/tmp/cache",
    });
    assert.equal(resolved.command, process.execPath);
    assert.deepEqual(resolved.args, ["-e", "process.exit(0)"]);
  });

  it("keeps node as a name for container execution", () => {
    const resolved = resolveStageCommand({
      stage: {
        id: "noop",
        action: "raw.command",
        command: "node",
        args: ["index.js"],
      },
      cell: { cellId: "default", axes: {} },
      cacheDir: "/tmp/cache",
      executionTarget: "container",
    });
    assert.equal(resolved.command, "node");
  });

  it("maps project.build through packageManager axis", () => {
    const prev = process.env["JSBENCH_NPM"];
    process.env["JSBENCH_NPM"] = process.execPath;
    try {
      const resolved = resolveStageCommand({
        stage: { id: "build", action: "project.build" },
        cell: { cellId: "packagemanager-npm", axes: { packageManager: "npm" } },
        cacheDir: "/tmp/jsbench-cache",
      });
      assert.deepEqual(resolved.args, ["run", "build"]);
      assert.ok(resolved.extraEnv?.["npm_config_cache"]?.includes("jsbench-cache"));
    } finally {
      if (prev === undefined) {
        process.env["JSBENCH_NPM"] = undefined;
      } else {
        process.env["JSBENCH_NPM"] = prev;
      }
    }
  });

  it("rejects shell actions", () => {
    assert.throws(
      () =>
        resolveStageCommand({
          stage: { id: "x", action: "shell", command: "echo" },
          cell: { cellId: "default", axes: {} },
          cacheDir: "/tmp/cache",
        }),
      /Shell actions are forbidden/,
    );
  });
});

describe("CLI MVP (S8)", () => {
  it("doctor returns 0 when Node is available", async () => {
    const code = await runCli(["doctor", "--log-level", "error"]);
    assert.equal(code, ExitCode.Success);
  });

  it("run executes raw.command fixture and writes reports", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-cli-"));
    try {
      const code = await runCli([
        "run",
        "--profile",
        FIXTURE,
        "--output-dir",
        join(root, "reports"),
        "--workspace-root",
        join(root, "generated"),
        "--log-level",
        "error",
      ]);
      assert.equal(code, ExitCode.Success);

      // stdout from last runCli call is hard to capture; read reports dir via known structure
      const { readdir } = await import("node:fs/promises");
      const runs = await readdir(join(root, "reports"));
      assert.equal(runs.length, 1);
      const runId = runs[0];
      assert.ok(runId);
      const runJson = JSON.parse(
        await readFile(join(root, "reports", runId, "run.json"), "utf8"),
      ) as { status: string; results: unknown[] };
      assert.equal(runJson.status, "completed");
      assert.ok(runJson.results.length >= 2);
      const summary = await readFile(join(root, "reports", runId, "summary.md"), "utf8");
      assert.match(summary, /Benchmark Report/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("run failure exits with stage failure code", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-cli-fail-"));
    try {
      const code = await runCli([
        "run",
        "--profile",
        FAIL_FIXTURE,
        "--output-dir",
        join(root, "reports"),
        "--workspace-root",
        join(root, "generated"),
        "--log-level",
        "error",
      ]);
      assert.equal(code, ExitCode.StageFailure);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("dry-run still prints a plan without executing", async () => {
    const code = await runCli(["run", "--profile", FIXTURE, "--dry-run", "--log-level", "error"]);
    assert.equal(code, ExitCode.Success);
  });

  it("runs native-smoke by profile id", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-smoke-"));
    try {
      const code = await runCli([
        "run",
        "--profile",
        "native-smoke",
        "--output-dir",
        join(root, "reports"),
        "--workspace-root",
        join(root, "generated"),
        "--log-level",
        "error",
      ]);
      assert.equal(code, ExitCode.Success);
      const { readdir } = await import("node:fs/promises");
      const runs = await readdir(join(root, "reports"));
      assert.equal(runs.length, 1);
      const runId = runs[0];
      assert.ok(runId);
      const runJson = JSON.parse(
        await readFile(join(root, "reports", runId, "run.json"), "utf8"),
      ) as { status: string; profile: { id: string } };
      assert.equal(runJson.status, "completed");
      assert.equal(runJson.profile.id, "native-smoke");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
