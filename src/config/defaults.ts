import type { JsBenchConfig } from "./types.js";

export const DEFAULT_CONFIG: JsBenchConfig = {
  outputDir: "./reports",
  workspaceRoot: "./generated",
  defaultRunner: "native",
  strictDoctor: true,
  profilesDir: "./profiles",
  logLevel: "info",
  redactEnv: [".*TOKEN.*", ".*SECRET.*", ".*PASSWORD.*", ".*API[_-]?KEY.*"],
  toolchains: {
    node: "policy:lts-active",
  },
  plugins: [],
};
