/**
 * DI token symbols shared by the composition root.
 * Kept separate from Container to avoid circular imports as modules grow.
 */
export const tokens = {
  Logger: Symbol.for("jsbench.Logger"),
  Config: Symbol.for("jsbench.Config"),
} as const;
