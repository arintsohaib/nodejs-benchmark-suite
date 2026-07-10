import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHtmlReporter } from "./html-reporter.js";
import { createMarkdownReporter } from "./markdown-reporter.js";
import type { RunArtifact, RunStatus } from "./types.js";
import { assertValidRunArtifact } from "./validate-run-artifact.js";

export type RunManifest = {
  readonly runId: string;
  readonly status: RunStatus;
  readonly createdAt: string;
  readonly finishedAt?: string;
  readonly suiteVersion: string;
  readonly schemaVersion: number;
  readonly artifacts: {
    readonly runJson: string;
    readonly summaryMd?: string;
    readonly indexHtml?: string;
  };
};

export type WriteRunArtifactOptions = {
  /** Also write `summary.md` via the Markdown reporter. Default: true. */
  readonly writeMarkdown?: boolean;
  /** Also write `index.html` via the HTML reporter. Default: true. */
  readonly writeHtml?: boolean;
  /** Skip JSON Schema validation (tests only). Default: false. */
  readonly skipValidation?: boolean;
};

export type WriteRunArtifactResult = {
  readonly outDir: string;
  readonly runJsonPath: string;
  readonly manifestPath: string;
  readonly summaryMdPath?: string;
  readonly indexHtmlPath?: string;
};

/**
 * Persist an immutable run directory: `manifest.json`, `run.json`, optional reports.
 * Does not mutate prior run directories — caller chooses a unique `outDir` / run id.
 */
export async function writeRunArtifact(
  artifact: RunArtifact,
  outDir: string,
  options: WriteRunArtifactOptions = {},
): Promise<WriteRunArtifactResult> {
  if (options.skipValidation !== true) {
    assertValidRunArtifact(artifact);
  }

  await mkdir(outDir, { recursive: true });
  const runJsonPath = join(outDir, "run.json");
  const manifestPath = join(outDir, "manifest.json");

  await writeFile(runJsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  const writeMarkdown = options.writeMarkdown !== false;
  const writeHtml = options.writeHtml !== false;
  let summaryMdPath: string | undefined;
  let indexHtmlPath: string | undefined;
  if (writeMarkdown) {
    await createMarkdownReporter().render(artifact, outDir);
    summaryMdPath = join(outDir, "summary.md");
  }
  if (writeHtml) {
    await createHtmlReporter().render(artifact, outDir);
    indexHtmlPath = join(outDir, "index.html");
  }

  const manifest: RunManifest = {
    runId: artifact.runId,
    status: artifact.status,
    createdAt: artifact.createdAt,
    ...(artifact.finishedAt !== undefined ? { finishedAt: artifact.finishedAt } : {}),
    suiteVersion: artifact.suiteVersion,
    schemaVersion: artifact.schemaVersion,
    artifacts: {
      runJson: "run.json",
      ...(summaryMdPath !== undefined ? { summaryMd: "summary.md" } : {}),
      ...(indexHtmlPath !== undefined ? { indexHtml: "index.html" } : {}),
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    outDir,
    runJsonPath,
    manifestPath,
    ...(summaryMdPath !== undefined ? { summaryMdPath } : {}),
    ...(indexHtmlPath !== undefined ? { indexHtmlPath } : {}),
  };
}
