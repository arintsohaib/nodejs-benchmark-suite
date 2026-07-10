import { performance } from "node:perf_hooks";
import { runWithOptionalCollectors } from "../metrics/run-collectors.js";
import type { StageContext } from "../metrics/types.js";

const OVERHEAD_CTX: StageContext = {
  runId: "overhead",
  cellId: "default",
  stageId: "noop",
  iteration: 1,
  iterationKind: "measured",
  workspacePath: ".",
};

export type OrchestrationOverheadResult = {
  readonly samplesMs: readonly number[];
  readonly medianMs: number;
  /** NFR-03 target fraction for stages ≥ 5s (1%). */
  readonly budgetFraction: number;
  readonly minStageMsForBudget: number;
};

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

/**
 * Measure suite orchestration wrapper cost (collector start/stop around an empty body).
 * Used to check NFR-03: overhead should be &lt; 1% of stages lasting ≥ 5s.
 */
export async function measureOrchestrationOverhead(
  options: {
    readonly iterations?: number;
  } = {},
): Promise<OrchestrationOverheadResult> {
  const iterations = options.iterations ?? 21;
  const samplesMs: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    await runWithOptionalCollectors({
      collectors: [],
      ctx: OVERHEAD_CTX,
      run: async () => undefined,
    });
    samplesMs.push(performance.now() - started);
  }
  return {
    samplesMs,
    medianMs: median(samplesMs),
    budgetFraction: 0.01,
    minStageMsForBudget: 5000,
  };
}

/** Whether measured overhead stays within the NFR-03 fraction for a given stage duration. */
export function isOrchestrationOverheadWithinBudget(options: {
  readonly overheadMs: number;
  readonly stageDurationMs: number;
  readonly budgetFraction?: number;
  readonly minStageMsForBudget?: number;
}): boolean {
  const minStage = options.minStageMsForBudget ?? 5000;
  if (options.stageDurationMs < minStage) {
    return true;
  }
  const fraction = options.budgetFraction ?? 0.01;
  return options.overheadMs / options.stageDurationMs <= fraction;
}
