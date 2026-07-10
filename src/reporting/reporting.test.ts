import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { diffRunArtifacts, renderDiffMarkdown } from "./diff.js";
import { collectEnvironmentFingerprint } from "./fingerprint.js";
import { truncateText } from "./format.js";
import { renderHtmlReport } from "./html-reporter.js";
import { loadRunArtifact } from "./load-run-artifact.js";
import { renderMarkdownSummary } from "./markdown-reporter.js";
import { deriveRunStatus } from "./status.js";
import type { RunArtifact, StageResult } from "./types.js";
import { assertValidRunArtifact, isValidRunArtifact } from "./validate-run-artifact.js";
import { writeRunArtifact } from "./write-run-artifact.js";

const HERE = dirname(fileURLToPath(import.meta.url));

async function loadFixture(): Promise<RunArtifact> {
  const raw = await readFile(join(HERE, "fixtures", "sample-run.json"), "utf8");
  return JSON.parse(raw) as RunArtifact;
}

describe("deriveRunStatus", () => {
  it("returns completed when all stages passed", () => {
    const results: StageResult[] = [
      {
        cellId: "default",
        stageId: "build",
        iteration: 1,
        iterationKind: "measured",
        status: "passed",
        durationMs: 1,
        metrics: {},
      },
    ];
    assert.equal(deriveRunStatus(results), "completed");
  });

  it("returns partial when mixed pass/fail", () => {
    const results: StageResult[] = [
      {
        cellId: "default",
        stageId: "a",
        iteration: 1,
        iterationKind: "measured",
        status: "passed",
        durationMs: 1,
        metrics: {},
      },
      {
        cellId: "default",
        stageId: "b",
        iteration: 1,
        iterationKind: "measured",
        status: "failed",
        durationMs: 1,
        metrics: {},
      },
    ];
    assert.equal(deriveRunStatus(results), "partial");
  });

  it("returns failed when empty or all failed", () => {
    assert.equal(deriveRunStatus([]), "failed");
    assert.equal(
      deriveRunStatus([
        {
          cellId: "default",
          stageId: "a",
          iteration: 1,
          iterationKind: "measured",
          status: "failed",
          durationMs: 1,
          metrics: {},
        },
      ]),
      "failed",
    );
  });
});

describe("RunArtifact schema", () => {
  it("accepts the fixture run.json", async () => {
    const artifact = await loadFixture();
    assert.equal(isValidRunArtifact(artifact), true);
    assertValidRunArtifact(artifact);
  });

  it("rejects missing required fields", () => {
    assert.equal(isValidRunArtifact({ runId: "x" }), false);
  });
});

describe("Markdown reporter", () => {
  it("matches the golden summary for the fixture", async () => {
    const artifact = await loadFixture();
    const actual = renderMarkdownSummary(artifact);
    const expected = await readFile(join(HERE, "fixtures", "sample-summary.golden.md"), "utf8");
    assert.equal(actual, expected);
  });
});

describe("HTML reporter", () => {
  it("matches the golden index.html for the fixture", async () => {
    const artifact = await loadFixture();
    const actual = renderHtmlReport(artifact);
    const expected = await readFile(join(HERE, "fixtures", "sample-index.golden.html"), "utf8");
    assert.equal(actual, expected);
  });
});

describe("report diff", () => {
  it("matches golden diff for known medians and missing cells", async () => {
    const left = await loadFixture();
    const right: RunArtifact = {
      ...left,
      runId: "20260711T000001Z-fixture-b",
      profile: { ...left.profile, digest: "def456digest" },
      aggregates: left.aggregates
        .filter((a) => a.stageId !== "build")
        .map((a) => {
          if (a.stageId === "install") {
            return {
              ...a,
              stats: { ...a.stats, median: 100, mean: 100, min: 90, max: 110, p95: 110 },
            };
          }
          return a;
        }),
    };
    const diff = diffRunArtifacts(left, right);
    const md = renderDiffMarkdown(diff);
    const expectedMd = await readFile(join(HERE, "fixtures", "sample-diff.golden.md"), "utf8");
    const expectedJson = JSON.parse(
      await readFile(join(HERE, "fixtures", "sample-diff.golden.json"), "utf8"),
    ) as unknown;
    assert.equal(md, expectedMd);
    assert.deepEqual(diff, expectedJson);
  });
});

describe("truncateText", () => {
  it("keeps short text unchanged and truncates long text", () => {
    assert.equal(truncateText("abc", 10), "abc");
    const long = "x".repeat(100);
    const out = truncateText(long, 40);
    assert.ok(out.length < long.length);
    assert.match(out, /truncated/);
  });
});

describe("writeRunArtifact", () => {
  it("writes manifest, run.json, summary.md, and index.html", async () => {
    const artifact = await loadFixture();
    const outDir = await mkdtemp(join(tmpdir(), "jsbench-report-"));
    try {
      const written = await writeRunArtifact(artifact, outDir);
      assert.ok(written.summaryMdPath);
      assert.ok(written.indexHtmlPath);
      const runJson = JSON.parse(await readFile(written.runJsonPath, "utf8")) as RunArtifact;
      assert.equal(runJson.runId, artifact.runId);
      assert.equal(runJson.status, "partial");
      const manifest = JSON.parse(await readFile(written.manifestPath, "utf8")) as {
        status: string;
        artifacts: { runJson: string; summaryMd?: string; indexHtml?: string };
      };
      assert.equal(manifest.status, "partial");
      assert.equal(manifest.artifacts.runJson, "run.json");
      assert.equal(manifest.artifacts.summaryMd, "summary.md");
      assert.equal(manifest.artifacts.indexHtml, "index.html");
      const summary = await readFile(written.summaryMdPath ?? "", "utf8");
      assert.match(summary, /Status: partial/);
      assert.match(summary, /Failed stages/);
      assert.match(summary, /## Citation/);
      const html = await readFile(written.indexHtmlPath ?? "", "utf8");
      assert.match(html, /<!DOCTYPE html>/);
      assert.match(html, /Partial run/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

describe("loadRunArtifact", () => {
  it("loads from a run directory", async () => {
    const artifact = await loadFixture();
    const outDir = await mkdtemp(join(tmpdir(), "jsbench-load-"));
    try {
      await writeFile(join(outDir, "run.json"), `${JSON.stringify(artifact, null, 2)}\n`);
      const loaded = await loadRunArtifact(outDir);
      assert.equal(loaded.runId, artifact.runId);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

describe("collectEnvironmentFingerprint", () => {
  it("collects native fingerprint with injected toolchains", async () => {
    const fp = await collectEnvironmentFingerprint({
      mode: "native",
      workspacePath: "/tmp/ws",
      toolchains: {
        node: { path: "/bin/node", version: "v22.0.0" },
      },
    });
    assert.equal(fp.mode, "native");
    assert.ok(fp.os.platform.length > 0);
    assert.ok(fp.cpu.coresLogical >= 1);
    assert.ok(fp.memory.totalBytes > 0);
    assert.equal(fp.toolchains["node"]?.version, "v22.0.0");
    assert.equal(fp.disk?.workspacePath, "/tmp/ws");
  });
});
