import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { BenchError } from "../../errors/bench-error.js";
import type { BenchmarkProfile } from "../../profiles/types.js";
import { runDockerExec } from "./exec.js";
import { resolveImagePolicy } from "./image-policy.js";
import { createDockerSession, removeDockerSession } from "./lifecycle.js";
import { planMount, resourceCreateArgs } from "./mount-planner.js";
import { resolveDockerOptions } from "./resolve-options.js";
import type { DockerCli } from "./types.js";

describe("resolveImagePolicy", () => {
  it("resolves node-lts-bookworm-slim from offline pins", () => {
    const resolved = resolveImagePolicy("node-lts-bookworm-slim");
    assert.equal(resolved.imageRef, "node:22-bookworm-slim");
    assert.equal(resolved.imagePolicy, "node-lts-bookworm-slim");
  });

  it("supports exact: refs", () => {
    const resolved = resolveImagePolicy("exact:node:20-alpine");
    assert.equal(resolved.imageRef, "node:20-alpine");
  });

  it("rejects unknown policies", () => {
    assert.throws(
      () => resolveImagePolicy("not-a-policy"),
      (error: unknown) => {
        assert.ok(error instanceof BenchError);
        assert.equal(error.code, "INVALID_PROFILE");
        return true;
      },
    );
  });
});

describe("planMount", () => {
  it("plans bind mounts", () => {
    const plan = planMount({
      mode: "bind",
      hostWorkspacePath: "/host/ws",
      workdir: "/workspace",
      volumeName: "vol",
    });
    assert.equal(plan.mode, "bind");
    assert.deepEqual(plan.createArgs, ["-v", "/host/ws:/workspace"]);
  });

  it("plans named-volume mounts", () => {
    const plan = planMount({
      mode: "named-volume",
      hostWorkspacePath: "/host/ws",
      workdir: "/workspace",
      volumeName: "jsbench-vol",
    });
    assert.equal(plan.mode, "named-volume");
    assert.equal(plan.volumeName, "jsbench-vol");
    assert.deepEqual(plan.createArgs, ["-v", "jsbench-vol:/workspace"]);
  });

  it("rejects unsupported mount modes", () => {
    assert.throws(
      () =>
        planMount({
          mode: "tmpfs",
          hostWorkspacePath: "/h",
          workdir: "/w",
          volumeName: "v",
        }),
      /not supported/,
    );
  });

  it("maps resource flags", () => {
    assert.deepEqual(
      resourceCreateArgs({ cpus: 2, memory: "1g", pidsLimit: 100, network: "none" }),
      ["--cpus", "2", "--memory", "1g", "--pids-limit", "100", "--network", "none"],
    );
  });
});

describe("resolveDockerOptions", () => {
  it("defaults image policy and bind mount", () => {
    const profile: BenchmarkProfile = {
      schemaVersion: 1,
      id: "p",
      workload: { template: "fixtures/x" },
      stages: [{ id: "s", action: "raw.command", command: "node" }],
      iterations: { measured: 1 },
      runner: { type: "docker" },
    };
    const opts = resolveDockerOptions(profile, { cellId: "default", axes: {} });
    assert.equal(opts.imagePolicy, "node-lts-bookworm-slim");
    assert.equal(opts.mount, "bind");
  });

  it("allows mount override from matrix axis", () => {
    const profile: BenchmarkProfile = {
      schemaVersion: 1,
      id: "p",
      workload: { template: "fixtures/x" },
      stages: [{ id: "s", action: "raw.command", command: "node" }],
      iterations: { measured: 1 },
      runner: { type: "docker", docker: { mount: "bind" } },
    };
    const opts = resolveDockerOptions(profile, {
      cellId: "mount-named-volume",
      axes: { mount: "named-volume" },
    });
    assert.equal(opts.mount, "named-volume");
  });
});

describe("docker lifecycle with mocked CLI", () => {
  it("creates, execs, and removes a bind session", async () => {
    const root = await mkdtemp(join(tmpdir(), "jsbench-dock-"));
    try {
      const calls: string[][] = [];
      const cli: DockerCli = {
        async exec(args) {
          calls.push([...args]);
          if (
            args[0] === "create" ||
            args[0] === "start" ||
            args[0] === "rm" ||
            args[0] === "exec"
          ) {
            return { exitCode: 0, stdout: "ok\n", stderr: "" };
          }
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      };

      const mount = planMount({
        mode: "bind",
        hostWorkspacePath: root,
        workdir: "/workspace",
        volumeName: "unused",
      });
      const session = await createDockerSession({
        cli,
        containerName: "jsbench-test",
        image: { imageRef: "node:22-bookworm-slim", imagePolicy: "node-lts-bookworm-slim" },
        mount,
        hostWorkspacePath: root,
        cpus: 1,
        memory: "512m",
      });
      assert.equal(session.containerName, "jsbench-test");
      assert.ok(calls.some((c) => c[0] === "create" && c.includes("--cpus")));

      const logDir = join(root, "logs");
      const result = await runDockerExec({
        cli,
        session,
        command: "node",
        args: ["index.js"],
        timeoutMs: 5000,
        logDir,
        logPrefix: "run-1",
      });
      assert.equal(result.status, "passed");
      assert.ok(calls.some((c) => c[0] === "exec" && c.includes("node")));

      await removeDockerSession({ cli, session, removeVolumes: false });
      assert.ok(calls.some((c) => c[0] === "rm"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
