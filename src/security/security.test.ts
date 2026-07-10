import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BenchError } from "../errors/bench-error.js";
import { assertSafeHostMountPath } from "./mount-allowlist.js";
import {
  isOrchestrationOverheadWithinBudget,
  measureOrchestrationOverhead,
} from "./orchestration-overhead.js";
import { assertNoShellAction, auditShellForbid } from "./shell-forbid.js";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("shell forbid", () => {
  it("rejects shell / unsafe.shell actions", () => {
    assert.throws(
      () => assertNoShellAction("shell"),
      (error: unknown) => {
        assert.ok(error instanceof BenchError);
        assert.equal(error.code, "INVALID_PROFILE");
        return true;
      },
    );
    assert.throws(() => assertNoShellAction("unsafe.shell"));
    assert.doesNotThrow(() => assertNoShellAction("raw.command"));
  });

  it("audits src/ for shell:true and required shell:false spawn sites", async () => {
    const result = await auditShellForbid(SRC_ROOT);
    assert.equal(result.offenders.length, 0, `shell:true found in: ${result.offenders.join(", ")}`);
    assert.equal(
      result.missingShellFalse.length,
      0,
      `missing shell:false in: ${result.missingShellFalse.join(", ")}`,
    );
    assert.ok(result.scannedFiles > 10);
  });
});

describe("mount allowlist", () => {
  it("allows paths under the workspace root", () => {
    assert.doesNotThrow(() =>
      assertSafeHostMountPath("/tmp/jsbench-ws/run/cell", {
        allowedRoots: ["/tmp/jsbench-ws"],
      }),
    );
  });

  it("rejects home, root, and paths outside allowlisted roots", () => {
    assert.throws(() => assertSafeHostMountPath("/", { allowedRoots: ["/tmp/ws"] }), /forbidden/);
    assert.throws(
      () => assertSafeHostMountPath("/etc", { allowedRoots: ["/tmp/ws"] }),
      /forbidden/,
    );
    assert.throws(
      () => assertSafeHostMountPath("/etc/passwd", { allowedRoots: ["/"] }),
      /forbidden/,
    );
    assert.throws(
      () =>
        assertSafeHostMountPath("/tmp/other/cell", {
          allowedRoots: ["/tmp/jsbench-ws"],
        }),
      /allowlisted/,
    );
  });
});

describe("orchestration overhead", () => {
  it("measures a small median wrapper cost and applies the NFR-03 budget", async () => {
    const measured = await measureOrchestrationOverhead({ iterations: 11 });
    assert.ok(measured.medianMs >= 0);
    assert.ok(measured.medianMs < 100, `unexpectedly high overhead: ${measured.medianMs}ms`);
    assert.equal(
      isOrchestrationOverheadWithinBudget({
        overheadMs: measured.medianMs,
        stageDurationMs: 5000,
      }),
      true,
    );
    assert.equal(
      isOrchestrationOverheadWithinBudget({
        overheadMs: 100,
        stageDurationMs: 5000,
      }),
      false,
    );
    assert.equal(
      isOrchestrationOverheadWithinBudget({
        overheadMs: 100,
        stageDurationMs: 1000,
      }),
      true,
    );
  });
});
