import type { RunStatus, StageResult } from "./types.js";

/**
 * Derive run status from stage results.
 * - no failures → `completed`
 * - failures and at least one pass → `partial`
 * - only failures / empty → `failed`
 */
export function deriveRunStatus(results: readonly StageResult[]): RunStatus {
  if (results.length === 0) {
    return "failed";
  }
  let passed = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "failed") {
      failed += 1;
    } else if (result.status === "passed") {
      passed += 1;
    }
  }
  if (failed === 0) {
    return "completed";
  }
  if (passed === 0) {
    return "failed";
  }
  return "partial";
}
