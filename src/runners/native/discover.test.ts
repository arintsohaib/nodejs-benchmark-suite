import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { discoverNativeToolchains, resolveOnPath } from "./discover.js";

describe("resolveOnPath", () => {
  it("resolves the current node binary when given an absolute path", () => {
    const resolved = resolveOnPath(process.execPath);
    assert.equal(resolved, process.execPath);
  });
});

describe("discoverNativeToolchains", () => {
  it("discovers node with a non-empty version", async () => {
    const tools = await discoverNativeToolchains();
    assert.ok(tools.node.path.length > 0);
    assert.ok(tools.node.version.length > 0);
    assert.match(tools.node.version, /^v?\d+/);
  });
});

describe("shell:true guard", () => {
  it("process-runner source never enables shell spawning", async () => {
    const path = fileURLToPath(new URL("./process-runner.ts", import.meta.url));
    const source = await readFile(path, "utf8");
    assert.match(source, /shell:\s*false/);
    assert.equal(/\bshell:\s*true\b/.test(source), false);
  });
});
