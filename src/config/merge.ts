import type { JsBenchConfig, JsBenchConfigPartial } from "./types.js";

export function mergeConfig(
  base: JsBenchConfig,
  ...layers: ReadonlyArray<JsBenchConfigPartial | undefined>
): JsBenchConfig {
  let current: JsBenchConfig = base;

  for (const layer of layers) {
    if (layer === undefined) {
      continue;
    }
    current = {
      outputDir: layer.outputDir ?? current.outputDir,
      workspaceRoot: layer.workspaceRoot ?? current.workspaceRoot,
      defaultRunner: layer.defaultRunner ?? current.defaultRunner,
      strictDoctor: layer.strictDoctor ?? current.strictDoctor,
      profilesDir: layer.profilesDir ?? current.profilesDir,
      logLevel: layer.logLevel ?? current.logLevel,
      redactEnv: layer.redactEnv ?? current.redactEnv,
      toolchains: {
        node: layer.toolchains?.node ?? current.toolchains.node,
      },
      plugins: layer.plugins ?? current.plugins,
    };
  }

  return current;
}
