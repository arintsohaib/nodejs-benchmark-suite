/**
 * Package-manager adapter types.
 * @see docs/03_ARCHITECTURE.md §3.6
 * @see docs/05_NATIVE_BENCHMARK.md §5.2
 */

export const PACKAGE_MANAGER_IDS = ["npm", "pnpm", "yarn"] as const;

export type PackageManagerId = (typeof PACKAGE_MANAGER_IDS)[number];

export type PackageManagerAction =
  | "packageManager.install"
  | "packageManager.install.cold"
  | "project.build"
  | "project.typecheck"
  | "project.test";

export type ResolvedPmCommand = {
  readonly command: string;
  readonly args: readonly string[];
  /** Run-scoped cache / linker env merged after scrub. */
  readonly extraEnv: Readonly<Record<string, string>>;
};

export type ResolvePmOptions = {
  /** When false, return the tool name (for container exec). Default true. */
  readonly resolveBinary?: boolean;
};

export type PackageManagerAdapter = {
  readonly id: PackageManagerId;
  resolve(
    action: PackageManagerAction,
    cacheDir: string,
    options?: ResolvePmOptions,
  ): ResolvedPmCommand;
};

export function isPackageManagerId(value: string): value is PackageManagerId {
  return (PACKAGE_MANAGER_IDS as readonly string[]).includes(value);
}

export function isPackageManagerAction(action: string): action is PackageManagerAction {
  return (
    action === "packageManager.install" ||
    action === "packageManager.install.cold" ||
    action === "project.build" ||
    action === "project.typecheck" ||
    action === "project.test"
  );
}
