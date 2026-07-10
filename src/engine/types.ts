import type { BenchmarkProfile } from "../profiles/types.js";

/**
 * Engine planning types and planner API.
 * Stage orchestration arrives in S8; process spawn is S6 (`runners/native`).
 * @see docs/03_ARCHITECTURE.md
 * @see docs/17_IMPLEMENTATION_PLAN.md S4
 */

export interface MatrixCell {
  readonly cellId: string;
  readonly axes: Readonly<Record<string, string | number | boolean>>;
}

export interface ResolvedStage {
  readonly id: string;
  readonly action: string;
  readonly cache?: "cold" | "warm";
  readonly timeoutMs?: number;
  readonly network?: boolean;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly reset?: "clean-install" | "keep-node-modules" | "purge-all";
}

export interface RunPlan {
  readonly runId: string;
  readonly profileDigest: string;
  readonly profile: BenchmarkProfile;
  readonly cells: readonly MatrixCell[];
  readonly stages: readonly ResolvedStage[];
  readonly iterations: number;
  readonly warmup: number;
}

/**
 * Expands a profile into an executable plan.
 * @see createPlanner in ./plan.ts
 */
export interface Planner {
  plan(profile: BenchmarkProfile, profileDigest: string): RunPlan;
}

/**
 * Executes a planned benchmark run.
 * @see executeRun in ./execute.ts (S8)
 */
export interface BenchmarkEngine {
  run(plan: RunPlan): Promise<void>;
}
