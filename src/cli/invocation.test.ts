import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLI_VIA_DIST, CLI_VIA_PNPM, cliCommand } from "./invocation.js";
import { type ProfileListItem, formatProfileListHuman } from "./list-profiles.js";

describe("cli invocation", () => {
  it("builds clone-local command strings", () => {
    assert.equal(cliCommand("doctor"), `${CLI_VIA_PNPM} doctor`);
    assert.equal(
      cliCommand("run --profile native-smoke"),
      `${CLI_VIA_PNPM} run --profile native-smoke`,
    );
    assert.ok(CLI_VIA_DIST.includes("dist/cli.js"));
  });
});

describe("formatProfileListHuman", () => {
  it("renders a tier table", () => {
    const items: ProfileListItem[] = [
      {
        id: "native-smoke",
        path: "/tmp/native-smoke.yaml",
        digest: "a".repeat(64),
        tier: "smoke",
        description: "[smoke] fast",
      },
    ];
    const text = formatProfileListHuman(items);
    assert.match(text, /native-smoke/);
    assert.match(text, /smoke/);
    assert.match(text, /pnpm jsbench run --profile native-smoke/);
  });
});
