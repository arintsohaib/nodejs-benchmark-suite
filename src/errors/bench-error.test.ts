import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BenchError, ExitCode, toExitCode } from "./bench-error.js";

describe("BenchError", () => {
  it("maps validation errors to exit code 2", () => {
    const error = new BenchError("INVALID_PROFILE", "bad profile");
    assert.equal(error.toExitCode(), ExitCode.InvalidConfig);
    assert.equal(toExitCode(error), ExitCode.InvalidConfig);
  });

  it("maps unknown errors to runtime failure", () => {
    assert.equal(toExitCode(new Error("boom")), ExitCode.RuntimeError);
  });

  it("maps TOOL_NOT_FOUND to doctor failure exit code 3", () => {
    const error = new BenchError("TOOL_NOT_FOUND", "missing node");
    assert.equal(error.toExitCode(), ExitCode.DoctorFailure);
  });

  it("maps DOCKER_ERROR to docker failure exit code 5", () => {
    const error = new BenchError("DOCKER_ERROR", "daemon down");
    assert.equal(error.toExitCode(), ExitCode.DockerError);
  });
});
