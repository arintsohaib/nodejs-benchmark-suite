import type { EnvironmentFingerprint, RunArtifact } from "./types.js";

export type ReplayToolchainHint = {
  readonly name: string;
  readonly recordedPath: string;
  readonly recordedVersion: string;
  /** Policy-style pin hint for reproduction docs (`exact:<version>`). */
  readonly exactHint: string;
};

export type ReplayPlan = {
  readonly sourceRunId: string;
  readonly suiteVersion: string;
  readonly schemaVersion: number;
  readonly profile: {
    readonly id: string;
    readonly digest: string;
    readonly path: string;
  };
  readonly environment: {
    readonly mode: EnvironmentFingerprint["mode"];
    readonly os: EnvironmentFingerprint["os"];
    readonly cpu: EnvironmentFingerprint["cpu"];
    readonly toolchains: readonly ReplayToolchainHint[];
    readonly docker?: EnvironmentFingerprint["docker"];
  };
  readonly plan: RunArtifact["plan"];
  readonly suggestedCommands: readonly string[];
  readonly notes: readonly string[];
};

function toExactHint(version: string): string {
  const trimmed = version.trim();
  const withoutV = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
  return `exact:${withoutV}`;
}

/**
 * Build a reproduction brief from a historical `run.json` (S20).
 * Does not execute stages — use `cmdReplay --execute` for that.
 */
export function buildReplayPlan(artifact: RunArtifact): ReplayPlan {
  const toolchains: ReplayToolchainHint[] = Object.entries(artifact.environment.toolchains)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, info]) => ({
      name,
      recordedPath: info.path,
      recordedVersion: info.version,
      exactHint: toExactHint(info.version),
    }));

  const profileRef = artifact.profile.id;
  const suggestedCommands = [
    "jsbench doctor",
    `jsbench validate-profile ${profileRef}`,
    `jsbench run --profile ${profileRef}`,
    "jsbench replay <this-run-dir> --execute",
  ];

  const notes = [
    "Check out the suite commit cited in the original report when reproducing published results.",
    `Confirm the local profile digest still matches \`${artifact.profile.digest}\` before comparing timings.`,
    "Install toolchains matching environment.toolchains (prefer exact: pins).",
    "Prefer the same OS major and similar CPU/storage class; expect variance otherwise.",
  ];

  if (artifact.environment.mode === "docker") {
    notes.push(
      "Docker runs: match imagePolicy / recorded image digest when present; mount mode affects timings.",
    );
  }

  return {
    sourceRunId: artifact.runId,
    suiteVersion: artifact.suiteVersion,
    schemaVersion: artifact.schemaVersion,
    profile: {
      id: artifact.profile.id,
      digest: artifact.profile.digest,
      path: artifact.profile.path,
    },
    environment: {
      mode: artifact.environment.mode,
      os: artifact.environment.os,
      cpu: artifact.environment.cpu,
      toolchains,
      ...(artifact.environment.docker !== undefined ? { docker: artifact.environment.docker } : {}),
    },
    plan: artifact.plan,
    suggestedCommands,
    notes,
  };
}
