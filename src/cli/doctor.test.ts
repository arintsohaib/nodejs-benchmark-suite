import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type DoctorResult, formatDoctorHuman } from "./doctor.js";
import { isSupportedNodeVersion, parseNodeMajor } from "./node-version.js";

describe("node-version", () => {
  it("parses majors and enforces >= 20", () => {
    assert.equal(parseNodeMajor("v22.22.1"), 22);
    assert.equal(parseNodeMajor("18.17.0"), 18);
    assert.equal(isSupportedNodeVersion("v22.22.1"), true);
    assert.equal(isSupportedNodeVersion("v18.17.0"), false);
  });
});

describe("formatDoctorHuman", () => {
  it("separates required vs optional and prints fixes", () => {
    const result: DoctorResult = {
      ok: true,
      exitCode: 0,
      summary: "Required OK. Missing optional: yarn.",
      strictDoctor: true,
      toolchains: { node: { path: "/bin/node", version: "v22.0.0" } },
      checks: [
        {
          id: "node",
          kind: "required",
          status: "ok",
          ok: true,
          detail: "v22.0.0 meets engines",
        },
        {
          id: "pnpm",
          kind: "optional",
          status: "missing",
          ok: false,
          detail: "pnpm not found",
          fix: "install pnpm via corepack",
        },
      ],
    };
    const text = formatDoctorHuman(result);
    assert.match(text, /Status: OK/);
    assert.match(text, /Required/);
    assert.match(text, /Optional/);
    assert.match(text, /\[missing\] pnpm/);
    assert.match(text, /install pnpm via corepack/);
    assert.match(text, /pnpm jsbench list-profiles/);
  });
});
