import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinResolver, identityVersionResolver } from "./version-resolver.js";

describe("createPinResolver", () => {
  it("pins policy specs from the offline pin file", () => {
    const resolver = createPinResolver();
    assert.equal(resolver.resolve("policy:latest-stable", "typescript"), "5.8.3");
    assert.equal(resolver.resolve("policy:latest-stable", "next"), "15.3.4");
    assert.equal(resolver.resolve("policy:latest-stable", "tailwindcss"), "4.3.2");
    assert.equal(resolver.resolve("^1.2.3", "left-pad"), "^1.2.3");
  });

  it("rejects unknown packages and missing package names", () => {
    const resolver = createPinResolver();
    assert.throws(
      () => resolver.resolve("policy:latest-stable", "not-a-real-pkg"),
      /No offline pin/,
    );
    assert.throws(() => resolver.resolve("policy:latest-stable"), /without a package name/);
  });

  it("identity resolver leaves policy strings unchanged", () => {
    const resolver = identityVersionResolver();
    assert.equal(resolver.resolve("policy:latest-stable", "typescript"), "policy:latest-stable");
  });
});
