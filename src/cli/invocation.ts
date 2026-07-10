/**
 * Canonical ways to invoke the suite from a git clone.
 * Prefer these strings in docs, help text, and replay hints — not a bare `jsbench`
 * that assumes a global install.
 */
export const CLI_VIA_PNPM = "pnpm jsbench";
export const CLI_VIA_DIST = "node dist/cli.js";

/** Minimum Node.js major version (matches package.json engines). */
export const MIN_NODE_MAJOR = 20;

/** Build a suggested command using the clone-local pnpm script. */
export function cliCommand(...parts: readonly string[]): string {
  return [CLI_VIA_PNPM, ...parts].join(" ");
}

/** Short note for help / doctor / replay about how to run the CLI. */
export function cliInvocationHelpLines(): readonly string[] {
  return [
    "Invoke from a clone:",
    `  ${CLI_VIA_PNPM} <command> [options]     # recommended (tsx; no build required)`,
    `  ${CLI_VIA_DIST} <command> [options]  # after: pnpm build`,
    "",
    `Requires Node.js >= ${MIN_NODE_MAJOR}. See README “First-time setup (Linux)”.`,
  ];
}
