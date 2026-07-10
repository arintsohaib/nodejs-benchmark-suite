import type { JsBenchConfig } from "../config/types.js";
import { createLogger } from "../logging/logger.js";
import { Container } from "./container.js";
import { tokens } from "./tokens.js";

/** Build the CLI composition root with config + logger wired. */
export function createAppContainer(config: JsBenchConfig): Container {
  const container = new Container();
  container.registerValue(tokens.Config, config);
  container.register(tokens.Logger, () => createLogger({ level: config.logLevel }));
  return container;
}
