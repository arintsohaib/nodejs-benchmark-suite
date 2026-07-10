import type { Collector } from "../metrics/types.js";
import type { Reporter } from "../reporting/types.js";

/** In-process plugin contract (v1). @see docs/03_ARCHITECTURE.md §9 */
export interface JsBenchPlugin {
  readonly id: string;
  readonly collectors?: ReadonlyArray<Collector | (() => Collector)>;
  readonly reporters?: ReadonlyArray<Reporter | (() => Reporter)>;
}

export type PluginModule = {
  readonly default?: JsBenchPlugin | (() => JsBenchPlugin);
  readonly plugin?: JsBenchPlugin | (() => JsBenchPlugin);
};
