import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatProfileTierLabel, inferProfileTier } from "./format.js";

describe("inferProfileTier", () => {
  it("classifies official smoke / benchmark / slow ids", () => {
    assert.equal(inferProfileTier("native-smoke"), "smoke");
    assert.equal(inferProfileTier("nextjs-app-smoke"), "smoke");
    assert.equal(inferProfileTier("install-build-matrix"), "benchmark");
    assert.equal(inferProfileTier("nextjs-app-benchmark"), "benchmark");
    assert.equal(inferProfileTier("nextjs-app-benchmark-slow"), "benchmark-slow");
    assert.equal(inferProfileTier("foundation-sample"), "custom");
    assert.equal(formatProfileTierLabel("smoke"), "smoke (fast)");
  });
});
