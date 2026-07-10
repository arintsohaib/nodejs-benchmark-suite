import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BenchError } from "../errors/bench-error.js";
import { Container } from "./container.js";
import { tokens } from "./tokens.js";

describe("Container", () => {
  it("resolves registered singletons", () => {
    const container = new Container();
    container.registerValue(tokens.Config, { ok: true });
    assert.deepEqual(container.resolve(tokens.Config), { ok: true });
  });

  it("memoizes factory results", () => {
    const container = new Container();
    let calls = 0;
    container.register(tokens.Logger, () => {
      calls += 1;
      return { id: calls };
    });
    const first = container.resolve<{ id: number }>(tokens.Logger);
    const second = container.resolve<{ id: number }>(tokens.Logger);
    assert.equal(first.id, 1);
    assert.equal(second.id, 1);
    assert.equal(calls, 1);
  });

  it("throws when token is missing", () => {
    const container = new Container();
    assert.throws(() => container.resolve(tokens.Logger), BenchError);
  });

  it("registerValue replaces a prior factory", () => {
    const container = new Container();
    container.register(tokens.Config, () => ({ from: "factory" }));
    container.registerValue(tokens.Config, { from: "value" });
    assert.deepEqual(container.resolve(tokens.Config), { from: "value" });
  });
});
